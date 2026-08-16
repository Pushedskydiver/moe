import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { replyOrStatusClaimText } from './reply-or-status-claim-text.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'x',
    personaId: 'dom',
    callSite: 'dmReply',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-15T12:00:00.000Z',
    stopReason: 'tool_use',
    outputTokensRaw: 1,
    result,
  };
}

describe('replyOrStatusClaimText', () => {
  it('returns the dmReply text when a non-empty reply is present', () => {
    const text = replyOrStatusClaimText(
      fixture({
        ok: true,
        reply: 'looks fine to me',
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBe('looks fine to me');
  });

  it('falls back to the report_status claim when reply is empty', () => {
    const text = replyOrStatusClaimText(
      fixture({
        ok: true,
        reply: '',
        toolUses: [
          {
            id: 't1',
            name: 'report_status',
            input: { claim: 'declining to approve until the diff is shown' },
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBe('declining to approve until the diff is shown');
  });

  it('prefers the dmReply text over a report_status claim when both are present', () => {
    const text = replyOrStatusClaimText(
      fixture({
        ok: true,
        reply: 'the actual reply',
        toolUses: [
          {
            id: 't1',
            name: 'report_status',
            input: { claim: 'a status claim' },
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBe('the actual reply');
  });

  it('returns empty when reply is empty and no report_status tool call exists', () => {
    const text = replyOrStatusClaimText(
      fixture({
        ok: true,
        reply: '',
        toolUses: [{ id: 't1', name: 'some_other_tool', input: {} }],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBe('');
  });

  it('returns empty when the report_status input has no string claim field', () => {
    const text = replyOrStatusClaimText(
      fixture({
        ok: true,
        reply: '',
        toolUses: [{ id: 't1', name: 'report_status', input: { claim: 42 } }],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBe('');
  });

  it('returns empty for a result shape with no toolUses field', () => {
    const text = replyOrStatusClaimText(
      fixture({
        ok: true,
        title: 't',
        body: 'b',
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(text).toBe('');
  });

  it('returns empty for an ok:false result', () => {
    const text = replyOrStatusClaimText(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
    );
    expect(text).toBe('');
  });
});
