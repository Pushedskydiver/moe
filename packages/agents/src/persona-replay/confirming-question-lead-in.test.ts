import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { confirmingQuestionLeadIn } from './confirming-question-lead-in.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'x',
    personaId: 'sarah',
    callSite: 'confirmingQuestion',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'end_turn',
    outputTokensRaw: 1,
    result,
  };
}

describe('confirmingQuestionLeadIn', () => {
  it('returns the lead-in text for a confirmingQuestion-shaped ok result', () => {
    const leadIn = confirmingQuestionLeadIn(
      fixture({
        ok: true,
        questionLeadIn: 'no numbers or step named',
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(leadIn).toBe('no numbers or step named');
  });

  it('returns undefined for a dmReply-shaped ok result (no questionLeadIn field)', () => {
    const leadIn = confirmingQuestionLeadIn(
      fixture({
        ok: true,
        reply: 'hi',
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(leadIn).toBeUndefined();
  });

  it('returns undefined for an ok:false result', () => {
    const leadIn = confirmingQuestionLeadIn(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
    );
    expect(leadIn).toBeUndefined();
  });
});
