import { describe, expect, it } from 'vitest';

import {
  evaluateHighBandCostAndRhythmOutcomeReason,
  evaluateMidBandCostAndRhythmOutcomeReason,
  shouldLogAppropriatenessFailure,
} from './ambient-guard-outcome-reason.js';

describe('evaluateHighBandCostAndRhythmOutcomeReason', () => {
  it('maps a cost-cap halt to high-band-cost-cap', () => {
    expect(evaluateHighBandCostAndRhythmOutcomeReason('cost-cap-reached')).toBe(
      'high-band-cost-cap',
    );
  });

  it('maps an off-hours block to high-band-off-hours', () => {
    expect(
      evaluateHighBandCostAndRhythmOutcomeReason('outside-core-hours'),
    ).toBe('high-band-off-hours');
  });
});

describe('evaluateMidBandCostAndRhythmOutcomeReason', () => {
  it('maps a cost-cap halt to mid-band-cost-cap', () => {
    expect(evaluateMidBandCostAndRhythmOutcomeReason('cost-cap-reached')).toBe(
      'mid-band-cost-cap',
    );
  });

  it('maps an off-hours block to mid-band-off-hours', () => {
    expect(
      evaluateMidBandCostAndRhythmOutcomeReason('outside-core-hours'),
    ).toBe('mid-band-off-hours');
  });
});

describe('shouldLogAppropriatenessFailure', () => {
  it('logs an infrastructure blip (evaluation-failed)', () => {
    expect(shouldLogAppropriatenessFailure('evaluation-failed')).toBe(true);
  });

  it('stays silent for a genuine inappropriate verdict (BUILD_PLAN 3.10 settled design)', () => {
    expect(shouldLogAppropriatenessFailure('inappropriate')).toBe(false);
  });
});
