import type { ReplayFixture } from './replay-fixture.js';

import { describe, expect, it } from 'vitest';

import { planApproach } from './plan-approach.js';

function fixture(result: ReplayFixture['result']): ReplayFixture {
  return {
    scenarioId: 'x',
    personaId: 'marcus',
    callSite: 'plan',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'end_turn',
    outputTokensRaw: 1,
    result,
  };
}

describe('planApproach', () => {
  it('returns the approach text for a plan-shaped ok result', () => {
    const approach = planApproach(
      fixture({
        ok: true,
        approach: 'Add a bounded retry count with a sane default.',
        confidence: 'High',
        alternativesConsidered: [],
        openQuestions: [],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(approach).toBe('Add a bounded retry count with a sane default.');
  });

  it('returns undefined for a brief-shaped ok result (no approach field)', () => {
    const approach = planApproach(
      fixture({
        ok: true,
        summary: 'The export CLI drops rows over 10k.',
        scope: ['Reproduce the truncation'],
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    );
    expect(approach).toBeUndefined();
  });

  it('returns undefined for an ok:false result', () => {
    const approach = planApproach(
      fixture({
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      }),
    );
    expect(approach).toBeUndefined();
  });
});
