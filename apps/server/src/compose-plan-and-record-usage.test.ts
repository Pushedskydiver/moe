import type { HandlerDeps } from './handle-inbound-message.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvePersonaModel } from '@moe/agents';

import { composePlanAndRecordUsage } from './compose-plan-and-record-usage.js';

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
            approach: 'Add a bounded retry count with a sane default.',
            confidence: 'High',
            alternativesConsidered: ['Exponential backoff'],
            openQuestions: ['What happens after retries are exhausted?'],
          },
          usage: { input_tokens: 130, output_tokens: 90 },
        }),
    },
    personaId: overrides.personaId ?? ('marcus' as const),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    costStore: {
      recordUsage:
        overrides.recordUsage ??
        vi.fn<HandlerDeps['costStore']['recordUsage']>().mockResolvedValue({
          ok: true,
          usage: {
            personaId: 'marcus',
            day: '2026-09-04',
            inputTokens: 130,
            outputTokens: 90,
            costUsdMicros: 1200,
            updatedAt: new Date('2026-09-04T09:00:00.000Z'),
          },
        }),
    },
  };
}

// `composePlan`'s own client shape is `{ messages: { parse } }` — this file's `deps` above nests
// `parse` directly to keep the fixture terse; wrapped here to match the real call shape.
function withMessagesWrapper(deps: ReturnType<typeof makeDeps>) {
  return {
    ...deps,
    anthropicClient: { messages: { parse: deps.anthropicClient.parse } },
  };
}

describe('composePlanAndRecordUsage', () => {
  it('returns the composed plan and records usage on a successful compose', async () => {
    const deps = withMessagesWrapper(makeDeps());

    const result = await composePlanAndRecordUsage(deps as never, {
      title: 'webhook delivery retries indefinitely',
      briefSummary: 'Fix unbounded webhook retries.',
      briefScope: ['Add a maximum retry count'],
      now: new Date('2026-09-04T09:00:00.000Z'),
    });

    expect(result).toEqual({
      approach: 'Add a bounded retry count with a sane default.',
      confidence: 'High',
      alternativesConsidered: ['Exponential backoff'],
      openQuestions: ['What happens after retries are exhausted?'],
    });
    expect(deps.costStore.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 130, outputTokens: 90 }),
    );
  });

  it('sends title and brief summary/scope in the user turn', async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composePlanAndRecordUsage(deps as never, {
      title: 'webhook delivery retries indefinitely',
      briefSummary: 'Fix unbounded webhook retries.',
      briefScope: ['Add a maximum retry count'],
      now: new Date('2026-09-04T09:00:00.000Z'),
    });

    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).toContain(
      'webhook delivery retries indefinitely',
    );
    expect(call.messages[0]?.content).toContain(
      'Fix unbounded webhook retries.',
    );
    expect(call.messages[0]?.content).toContain('Add a maximum retry count');
  });

  it('resolves the model via resolvePersonaModel(deps.personaId), not a hardcoded literal', async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composePlanAndRecordUsage(deps as never, {
      title: 'anything',
      briefSummary: 'summary',
      briefScope: [],
      now: new Date('2026-09-04T09:00:00.000Z'),
    });

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: resolvePersonaModel(deps.personaId) }),
    );
  });

  it("prepends the persona's real prompt.md content ahead of the plan task instructions when the persona has one", async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composePlanAndRecordUsage(deps as never, {
      title: 'anything',
      briefSummary: 'summary',
      briefScope: [],
      now: new Date('2026-09-04T09:00:00.000Z'),
    });

    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(2);
    expect(call.system[0]?.text).toContain("You're Marcus");
  });

  describe('a persona with no prompt.md yet (mocked ENOENT, not a real on-disk gap)', () => {
    afterEach(() => {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
    });

    it('sends only the plan task instructions (no persona block)', async () => {
      vi.resetModules();
      vi.doMock('node:fs/promises', () => ({
        readFile: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('no such file'), { code: 'ENOENT' }),
          ),
      }));
      const { composePlanAndRecordUsage: composeWithMockedFs } =
        await import('./compose-plan-and-record-usage.js');
      const deps = withMessagesWrapper(makeDeps());

      await composeWithMockedFs(deps as never, {
        title: 'anything',
        briefSummary: 'summary',
        briefScope: [],
        now: new Date('2026-09-04T09:00:00.000Z'),
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

    const result = await composePlanAndRecordUsage(deps as never, {
      title: 'anything',
      briefSummary: 'summary',
      briefScope: [],
      now: new Date('2026-09-04T09:00:00.000Z'),
    });

    expect(result).toBeUndefined();
    expect(deps.logger.error).toHaveBeenCalledWith('failed to compose plan', {
      errorMessage: 'rate limited',
    });
    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
  });
});
