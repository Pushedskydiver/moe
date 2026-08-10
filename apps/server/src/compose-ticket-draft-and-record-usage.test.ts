import type { HandlerDeps } from './handle-inbound-message.js';

import { describe, expect, it, vi } from 'vitest';

import { resolvePersonaModel } from '@moe/agents';

import { composeTicketDraftAndRecordUsage } from './compose-ticket-draft-and-record-usage.js';

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
          parsed_output: { title: 'CLI hangs', body: 'The CLI hangs.' },
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

// `composeTicketDraft`'s own client shape is `{ messages: { parse } }` — this file's `deps` above
// nests `parse` directly to keep the fixture terse; wrapped here to match the real call shape.
function withMessagesWrapper(deps: ReturnType<typeof makeDeps>) {
  return {
    ...deps,
    anthropicClient: { messages: { parse: deps.anthropicClient.parse } },
  };
}

describe('composeTicketDraftAndRecordUsage', () => {
  it('returns the drafted title/body and records usage on a successful compose', async () => {
    const deps = withMessagesWrapper(makeDeps());

    const result = await composeTicketDraftAndRecordUsage(deps as never, {
      text: 'the CLI hangs on large repos',
      now: new Date('2026-07-29T09:00:00.000Z'),
      failureLogMessage: 'failed to compose ticket draft',
    });

    expect(result).toEqual({ title: 'CLI hangs', body: 'The CLI hangs.' });
    expect(deps.costStore.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 120, outputTokens: 40 }),
    );
  });

  it('resolves the model via resolvePersonaModel(deps.personaId), not a hardcoded literal', async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composeTicketDraftAndRecordUsage(deps as never, {
      text: 'anything',
      now: new Date('2026-07-29T09:00:00.000Z'),
      failureLogMessage: 'failed to compose ticket draft',
    });

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: resolvePersonaModel(deps.personaId) }),
    );
  });

  it("prepends the persona's real prompt.md content ahead of the draft task instructions when the persona has one (BUILD_PLAN 5.3a-ii)", async () => {
    const deps = withMessagesWrapper(makeDeps());

    await composeTicketDraftAndRecordUsage(deps as never, {
      text: 'anything',
      now: new Date('2026-07-29T09:00:00.000Z'),
      failureLogMessage: 'failed to compose ticket draft',
    });

    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(2);
    expect(call.system[0]?.text).toContain(
      "You're moe's PM and the team's front door",
    );
  });

  it('sends only the draft task instructions (unchanged from before this chunk) for a persona without a prompt.md yet', async () => {
    const deps = withMessagesWrapper(makeDeps({ personaId: 'theo' }));

    await composeTicketDraftAndRecordUsage(deps as never, {
      text: 'anything',
      now: new Date('2026-07-29T09:00:00.000Z'),
      failureLogMessage: 'failed to compose ticket draft',
    });

    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(1);
  });

  it('returns undefined and logs under the caller-supplied failureLogMessage, without recording usage, on a composition failure', async () => {
    const deps = withMessagesWrapper(
      makeDeps({
        parse: vi.fn().mockRejectedValue(new Error('rate limited')),
      }),
    );

    const result = await composeTicketDraftAndRecordUsage(deps as never, {
      text: 'anything',
      now: new Date('2026-07-29T09:00:00.000Z'),
      failureLogMessage: 'failed to regenerate ticket draft',
    });

    expect(result).toBeUndefined();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to regenerate ticket draft',
      { errorMessage: 'rate limited' },
    );
    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
  });
});
