import type { HandlerDeps } from './handle-inbound-message.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvePersonaModel } from '@moe/agents';

import { composeBriefAndRecordUsage } from './compose-brief-and-record-usage.js';

function makeDeps(
  overrides: {
    readonly parse?: ReturnType<typeof vi.fn>;
    readonly recordUsage?: HandlerDeps['costStore']['recordUsage'];
    readonly personaId?: HandlerDeps['personaId'];
  } = {},
) {
  return {
    anthropicClient: {
      parse:
        overrides.parse ??
        vi.fn().mockResolvedValue({
          parsed_output: {
            summary: 'The CLI silently drops rows over 10k.',
            scope: ['Reproduce the truncation'],
          },
          usage: { input_tokens: 120, output_tokens: 40 },
        }),
    },
    personaId: overrides.personaId ?? ('sarah' as const),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    costStore: {
      recordUsage:
        overrides.recordUsage ??
        vi.fn<HandlerDeps['costStore']['recordUsage']>().mockResolvedValue({
          ok: true,
          usage: {
            personaId: 'sarah',
            day: '2026-07-29',
            inputTokens: 120,
            outputTokens: 40,
            costUsdMicros: 640,
            updatedAt: new Date('2026-07-29T09:00:00.000Z'),
          },
        }),
    },
  };
}

// `composeBrief`'s own client shape is `{ messages: { parse } }` — this file's `deps` above
// nests `parse` directly to keep the fixture terse; wrapped here to match the real call shape.
function withMessagesWrapper(deps: ReturnType<typeof makeDeps>) {
  return {
    ...deps,
    anthropicClient: { messages: { parse: deps.anthropicClient.parse } },
  };
}

describe('composeBriefAndRecordUsage', () => {
  it('returns the composed summary/scope and records usage on a successful compose', async () => {
    const deps = withMessagesWrapper(makeDeps());

    const result = await composeBriefAndRecordUsage(deps as never, {
      title: 'Export CLI drops rows over 10k',
      now: new Date('2026-07-29T09:00:00.000Z'),
    });

    expect(result).toEqual({
      summary: 'The CLI silently drops rows over 10k.',
      scope: ['Reproduce the truncation'],
    });
    expect(deps.costStore.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 120, outputTokens: 40 }),
    );
  });

  it('sends both title and body when body is given', async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composeBriefAndRecordUsage(deps as never, {
      title: 'Export CLI drops rows over 10k',
      body: 'Users report the CSV export truncates past 10,000 rows.',
      now: new Date('2026-07-29T09:00:00.000Z'),
    });

    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).toContain(
      'Export CLI drops rows over 10k',
    );
    expect(call.messages[0]?.content).toContain(
      'Users report the CSV export truncates past 10,000 rows.',
    );
  });

  it('resolves the model via resolvePersonaModel(deps.personaId), not a hardcoded literal', async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composeBriefAndRecordUsage(deps as never, {
      title: 'anything',
      now: new Date('2026-07-29T09:00:00.000Z'),
    });

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: resolvePersonaModel(deps.personaId) }),
    );
  });

  it("prepends the persona's real prompt.md content ahead of the brief task instructions when the persona has one", async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composeBriefAndRecordUsage(deps as never, {
      title: 'anything',
      now: new Date('2026-07-29T09:00:00.000Z'),
    });

    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(2);
    expect(call.system[0]?.text).toContain(
      "You're moe's PM and the team's front door",
    );
  });

  describe('a persona with no prompt.md yet (mocked ENOENT, not a real on-disk gap)', () => {
    afterEach(() => {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
    });

    it('sends only the brief task instructions (no persona block)', async () => {
      vi.resetModules();
      vi.doMock('node:fs/promises', () => ({
        readFile: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('no such file'), { code: 'ENOENT' }),
          ),
      }));
      const { composeBriefAndRecordUsage: composeWithMockedFs } =
        await import('./compose-brief-and-record-usage.js');
      const deps = withMessagesWrapper(makeDeps());

      await composeWithMockedFs(deps as never, {
        title: 'anything',
        now: new Date('2026-07-29T09:00:00.000Z'),
      });

      const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
        system: ReadonlyArray<{ readonly text: string }>;
      };
      expect(call.system).toHaveLength(1);
    });
  });

  it('returns undefined and logs the failure, without recording usage, on a composition failure', async () => {
    const deps = withMessagesWrapper(
      makeDeps({
        parse: vi.fn().mockRejectedValue(new Error('rate limited')),
      }),
    );

    const result = await composeBriefAndRecordUsage(deps as never, {
      title: 'anything',
      now: new Date('2026-07-29T09:00:00.000Z'),
    });

    expect(result).toBeUndefined();
    expect(deps.logger.error).toHaveBeenCalledWith('failed to compose brief', {
      errorMessage: 'rate limited',
    });
    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
  });
});
