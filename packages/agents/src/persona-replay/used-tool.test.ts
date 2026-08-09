import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { usedTool } from './used-tool.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'x',
    personaId: 'sarah',
    callSite: 'dmReply',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'tool_use',
    outputTokensRaw: 1,
    result,
  };
}

describe('usedTool', () => {
  it('returns true when the named tool appears in toolUses', () => {
    const found = usedTool(
      fixture({
        ok: true,
        reply: '',
        toolUses: [{ id: 't1', name: 'report_status', input: {} }],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
      'report_status',
    );
    expect(found).toBe(true);
  });

  it('returns false when the named tool does not appear', () => {
    const found = usedTool(
      fixture({
        ok: true,
        reply: 'hi',
        toolUses: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
      'report_status',
    );
    expect(found).toBe(false);
  });

  it('returns false for a result shape with no toolUses field', () => {
    const found = usedTool(
      fixture({
        ok: true,
        title: 't',
        body: 'b',
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
      'report_status',
    );
    expect(found).toBe(false);
  });

  it('returns false for an ok:false result', () => {
    const found = usedTool(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
      'report_status',
    );
    expect(found).toBe(false);
  });
});
