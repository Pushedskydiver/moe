import { describe, expect, it } from 'vitest';

import { evaluateCostCap } from './evaluate-cost-cap.js';

const CAP = 100_000_000; // $100

describe('evaluateCostCap', () => {
  it('halts and reports no newly-crossed thresholds when nothing has changed below 50%', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 10_000_000, // 10%
      capUsdMicros: CAP,
      highestThresholdAlerted: 0,
    });

    expect(result).toEqual({ halt: false, newlyCrossedThresholds: [] });
  });

  it('reports 50 as newly crossed exactly at the 50% boundary', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 50_000_000,
      capUsdMicros: CAP,
      highestThresholdAlerted: 0,
    });

    expect(result).toEqual({ halt: false, newlyCrossedThresholds: [50] });
  });

  it('does not re-report 50 once already alerted', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 60_000_000,
      capUsdMicros: CAP,
      highestThresholdAlerted: 50,
    });

    expect(result).toEqual({ halt: false, newlyCrossedThresholds: [] });
  });

  it('reports 80 as newly crossed once 50 has already been alerted', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 85_000_000,
      capUsdMicros: CAP,
      highestThresholdAlerted: 50,
    });

    expect(result).toEqual({ halt: false, newlyCrossedThresholds: [80] });
  });

  it('reports both 50 and 80 in one pass when a single jump crosses both at once', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 85_000_000,
      capUsdMicros: CAP,
      highestThresholdAlerted: 0,
    });

    expect(result).toEqual({ halt: false, newlyCrossedThresholds: [50, 80] });
  });

  it('halts and reports 100 as newly crossed exactly at the cap', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 100_000_000,
      capUsdMicros: CAP,
      highestThresholdAlerted: 80,
    });

    expect(result).toEqual({ halt: true, newlyCrossedThresholds: [100] });
  });

  it('halts without re-reporting 100 once already alerted', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 150_000_000,
      capUsdMicros: CAP,
      highestThresholdAlerted: 100,
    });

    expect(result).toEqual({ halt: true, newlyCrossedThresholds: [] });
  });

  it('halts on spend that exceeds the cap outright, not just spend that lands on it', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 250_000_000,
      capUsdMicros: CAP,
      highestThresholdAlerted: 0,
    });

    expect(result).toEqual({
      halt: true,
      newlyCrossedThresholds: [50, 80, 100],
    });
  });

  it('does not cross 50 one micro-USD below the exact boundary — no floating-point slop', () => {
    const result = evaluateCostCap({
      monthlyCostUsdMicros: 49_999_999,
      capUsdMicros: CAP,
      highestThresholdAlerted: 0,
    });

    expect(result).toEqual({ halt: false, newlyCrossedThresholds: [] });
  });
});
