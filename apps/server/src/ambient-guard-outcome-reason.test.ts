import { describe, expect, it } from 'vitest';

import {
  highBandCostAndRhythmOutcomeReason,
  midBandCostAndRhythmOutcomeReason,
  shouldLogAppropriatenessFailure,
} from './ambient-guard-outcome-reason.js';

describe('highBandCostAndRhythmOutcomeReason', () => {
  it('maps a cost-cap halt to high-band-cost-cap', () => {
    expect(highBandCostAndRhythmOutcomeReason('cost-cap-reached')).toBe(
      'high-band-cost-cap',
    );
  });

  it('maps an off-hours block to high-band-off-hours', () => {
    expect(highBandCostAndRhythmOutcomeReason('outside-core-hours')).toBe(
      'high-band-off-hours',
    );
  });
});

describe('midBandCostAndRhythmOutcomeReason', () => {
  it('maps a cost-cap halt to mid-band-cost-cap', () => {
    expect(midBandCostAndRhythmOutcomeReason('cost-cap-reached')).toBe(
      'mid-band-cost-cap',
    );
  });

  it('maps an off-hours block to mid-band-off-hours', () => {
    expect(midBandCostAndRhythmOutcomeReason('outside-core-hours')).toBe(
      'mid-band-off-hours',
    );
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
