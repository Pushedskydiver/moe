import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { reactsOrRepliesBriefly } from './reacts-or-replies-briefly.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'plain-acknowledgment-react-grounding',
    personaId: 'sarah',
    callSite: 'dmReply',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-09-10T12:00:00.000Z',
    stopReason: 'tool_use',
    outputTokensRaw: 1,
    result,
  };
}

describe('reactsOrRepliesBriefly', () => {
  it('passes when the model reacts instead of replying, with no reply text alongside it', () => {
    const { check } = reactsOrRepliesBriefly();
    const passed = check(
      fixture({
        ok: true,
        reply: '',
        toolUses: [{ id: 't1', name: 'react', input: { reaction: 'eyes' } }],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(passed).toBe(true);
  });

  it('fails when the model reacts AND also writes a reply', () => {
    const { check } = reactsOrRepliesBriefly();
    const passed = check(
      fixture({
        ok: true,
        reply: 'Got it, thanks!',
        toolUses: [
          { id: 't1', name: 'react', input: { reaction: 'white_check_mark' } },
        ],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(passed).toBe(false);
  });

  it('passes for a short, non-empty text reply with no tool call', () => {
    const { check } = reactsOrRepliesBriefly();
    const passed = check(
      fixture({
        ok: true,
        reply: 'Sounds good, thanks for the heads up.',
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(passed).toBe(true);
  });

  it('fails for a long, padded reply with no tool call', () => {
    const { check } = reactsOrRepliesBriefly();
    const passed = check(
      fixture({
        ok: true,
        reply: 'x'.repeat(500),
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(passed).toBe(false);
  });

  it('fails for an empty reply with no tool call at all', () => {
    const { check } = reactsOrRepliesBriefly();
    const passed = check(
      fixture({
        ok: true,
        reply: '',
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(passed).toBe(false);
  });

  it('fails for an ok:false result', () => {
    const { check } = reactsOrRepliesBriefly();
    const passed = check(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
    );
    expect(passed).toBe(false);
  });
});
