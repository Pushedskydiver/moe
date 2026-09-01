import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { briefSummary } from './brief-summary.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'x',
    personaId: 'sarah',
    callSite: 'brief',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'end_turn',
    outputTokensRaw: 1,
    result,
  };
}

describe('briefSummary', () => {
  it('returns the summary text for a brief-shaped ok result', () => {
    const summary = briefSummary(
      fixture({
        ok: true,
        summary: 'The export CLI drops rows over 10k.',
        scope: ['Reproduce the truncation'],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(summary).toBe('The export CLI drops rows over 10k.');
  });

  it('returns undefined for a ticketDraft-shaped ok result (no summary field)', () => {
    const summary = briefSummary(
      fixture({
        ok: true,
        title: 't',
        body: 'the export throws a 500',
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(summary).toBeUndefined();
  });

  it('returns undefined for an ok:false result', () => {
    const summary = briefSummary(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
    );
    expect(summary).toBeUndefined();
  });
});
