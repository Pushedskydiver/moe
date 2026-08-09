import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { dmReplyText } from './dm-reply-text.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'x',
    personaId: 'sarah',
    callSite: 'dmReply',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'end_turn',
    outputTokensRaw: 1,
    result,
  };
}

describe('dmReplyText', () => {
  it('returns the reply text for a dmReply-shaped ok result', () => {
    const text = dmReplyText(
      fixture({
        ok: true,
        reply: 'hi',
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBe('hi');
  });

  it('returns undefined for a ticketDraft-shaped ok result (no reply field)', () => {
    const text = dmReplyText(
      fixture({
        ok: true,
        title: 't',
        body: 'b',
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBeUndefined();
  });

  it('returns undefined for an ok:false result', () => {
    const text = dmReplyText(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
    );
    expect(text).toBeUndefined();
  });
});
