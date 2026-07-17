import { describe, expect, it } from 'vitest';

import {
  personaCostAlertSchema,
  personaCostMonthlyTotalSchema,
} from './cost-cap.js';

function validAlert() {
  return {
    personaId: 'sarah',
    month: '2026-07',
    highestThresholdAlerted: 50,
    updatedAt: new Date('2026-07-17T09:00:00.000Z'),
  };
}

describe('personaCostAlertSchema', () => {
  it('accepts a valid alert-state row', () => {
    expect(personaCostAlertSchema.safeParse(validAlert()).success).toBe(true);
  });

  it.each([0, 50, 80, 100])(
    'accepts %d as a valid highestThresholdAlerted rung',
    (threshold) => {
      const parsed = personaCostAlertSchema.safeParse({
        ...validAlert(),
        highestThresholdAlerted: threshold,
      });

      expect(parsed.success).toBe(true);
    },
  );

  it.each([1, 49, 51, 99, 101, -1])(
    'rejects %d as an invalid highestThresholdAlerted rung',
    (threshold) => {
      const parsed = personaCostAlertSchema.safeParse({
        ...validAlert(),
        highestThresholdAlerted: threshold,
      });

      expect(parsed.success).toBe(false);
    },
  );

  it('coerces a numeric-string highestThresholdAlerted — pg returns INTEGER columns as numbers but this keeps parity with the cost-usage schema pattern', () => {
    const parsed = personaCostAlertSchema.safeParse({
      ...validAlert(),
      highestThresholdAlerted: '80',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.highestThresholdAlerted).toBe(80);
  });

  it('rejects a month that is not YYYY-MM', () => {
    const parsed = personaCostAlertSchema.safeParse({
      ...validAlert(),
      month: '2026-7',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a blank personaId', () => {
    const parsed = personaCostAlertSchema.safeParse({
      ...validAlert(),
      personaId: '',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('personaCostMonthlyTotalSchema', () => {
  it('accepts a zero total — the shape a month with no spend yet produces', () => {
    const parsed = personaCostMonthlyTotalSchema.safeParse({
      personaId: 'sarah',
      month: '2026-07',
      inputTokens: 0,
      outputTokens: 0,
      costUsdMicros: 0,
    });

    expect(parsed.success).toBe(true);
  });

  it('coerces numeric-string totals — a SUM(BIGINT) comes back from pg as a string', () => {
    const parsed = personaCostMonthlyTotalSchema.safeParse({
      personaId: 'sarah',
      month: '2026-07',
      inputTokens: '1200',
      outputTokens: '340',
      costUsdMicros: '5800',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.costUsdMicros).toBe(5_800);
  });
});
