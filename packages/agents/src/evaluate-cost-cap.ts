import { COST_CAP_THRESHOLDS } from '@moe/core';

export type CostCapEvaluation = {
  readonly halt: boolean;
  readonly newlyCrossedThresholds: readonly (typeof COST_CAP_THRESHOLDS)[number][];
};

/**
 * Decides, from a persona's current-month spend against its configured cap, whether new LLM
 * calls should halt and which alert-ladder rungs (`@moe/core`'s `COST_CAP_THRESHOLDS`, VISION
 * §10) were newly crossed since `highestThresholdAlerted` — the caller is responsible for
 * persisting the new watermark and sending any alerts; this function only decides. A single
 * turn's cost can cross more than one rung at once (a large turn jumping straight from 40% to
 * 85%), so every rung above `highestThresholdAlerted` and at/below the current spend is reported,
 * not just the highest one. Threshold comparisons are exact integer arithmetic
 * (`cost * 100 >= threshold * cap`), not a float percentage division — `costUsdMicros`/cap are
 * both already-exact integers, and comparing a computed float percentage against 50/80/100 risks
 * a spend that lands exactly on a boundary failing to cross it by a fraction of a unit.
 */
export function evaluateCostCap(input: {
  readonly monthlyCostUsdMicros: number;
  readonly capUsdMicros: number;
  readonly highestThresholdAlerted: number;
}): CostCapEvaluation {
  const crossed = (threshold: number): boolean =>
    input.monthlyCostUsdMicros * 100 >= threshold * input.capUsdMicros;

  const newlyCrossedThresholds = COST_CAP_THRESHOLDS.filter(
    (threshold) =>
      crossed(threshold) && input.highestThresholdAlerted < threshold,
  );

  return {
    halt: crossed(100),
    newlyCrossedThresholds,
  };
}
