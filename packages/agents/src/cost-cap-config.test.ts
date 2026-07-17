import { describe, expect, it } from 'vitest';

import { parseCostCapConfig } from './cost-cap-config.js';

function validEnv() {
  return {
    MOE_COST_CAP_MONTHLY: '50',
    MOE_COST_ALERT_SLACK_USER_ID: 'U0ALEX123',
  };
}

describe('parseCostCapConfig', () => {
  it('parses a valid env into a CostCapConfig, converting the dollar cap to micro-USD', () => {
    const result = parseCostCapConfig(validEnv());

    expect(result).toEqual({
      ok: true,
      config: {
        monthlyCapUsdMicros: 50_000_000,
        alertSlackUserId: 'U0ALEX123',
      },
    });
  });

  it('converts a fractional-dollar cap correctly', () => {
    const result = parseCostCapConfig({
      ...validEnv(),
      MOE_COST_CAP_MONTHLY: '12.50',
    });

    expect(result.ok && result.config.monthlyCapUsdMicros).toBe(12_500_000);
  });

  it('returns ok:false when MOE_COST_CAP_MONTHLY is missing', () => {
    const result = parseCostCapConfig({
      MOE_COST_ALERT_SLACK_USER_ID: 'U0ALEX123',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_COST_CAP_MONTHLY is zero or negative', () => {
    expect(
      parseCostCapConfig({ ...validEnv(), MOE_COST_CAP_MONTHLY: '0' }).ok,
    ).toBe(false);
    expect(
      parseCostCapConfig({ ...validEnv(), MOE_COST_CAP_MONTHLY: '-5' }).ok,
    ).toBe(false);
  });

  it('returns ok:false when MOE_COST_CAP_MONTHLY is not numeric', () => {
    const result = parseCostCapConfig({
      ...validEnv(),
      MOE_COST_CAP_MONTHLY: 'fifty',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_COST_ALERT_SLACK_USER_ID is missing', () => {
    const result = parseCostCapConfig({ MOE_COST_CAP_MONTHLY: '50' });

    expect(result.ok).toBe(false);
  });
});
