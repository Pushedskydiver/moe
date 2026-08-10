import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { ticketDraftBody } from './ticket-draft-body.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'x',
    personaId: 'sarah',
    callSite: 'ticketDraft',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'end_turn',
    outputTokensRaw: 1,
    result,
  };
}

describe('ticketDraftBody', () => {
  it('returns the body text for a ticketDraft-shaped ok result', () => {
    const body = ticketDraftBody(
      fixture({
        ok: true,
        title: 't',
        body: 'the export throws a 500',
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(body).toBe('the export throws a 500');
  });

  it('returns undefined for a dmReply-shaped ok result (no body field)', () => {
    const body = ticketDraftBody(
      fixture({
        ok: true,
        reply: 'hi',
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(body).toBeUndefined();
  });

  it('returns undefined for an ok:false result', () => {
    const body = ticketDraftBody(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
    );
    expect(body).toBeUndefined();
  });
});
