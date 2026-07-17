import { describe, expect, it } from 'vitest';

import { personaCostUsageSchema, toUtcDay, toUtcMonth } from './cost-usage.js';

function validUsage() {
  return {
    personaId: 'sarah',
    day: '2026-07-17',
    inputTokens: 120,
    outputTokens: 340,
    costUsdMicros: 3_640,
    updatedAt: new Date('2026-07-17T09:00:00.000Z'),
  };
}

describe('personaCostUsageSchema', () => {
  it('accepts a valid usage row', () => {
    const parsed = personaCostUsageSchema.safeParse(validUsage());

    expect(parsed.success).toBe(true);
  });

  it('rejects a day that is not YYYY-MM-DD', () => {
    const parsed = personaCostUsageSchema.safeParse({
      ...validUsage(),
      day: '2026-7-17',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a blank personaId', () => {
    const parsed = personaCostUsageSchema.safeParse({
      ...validUsage(),
      personaId: '',
    });

    expect(parsed.success).toBe(false);
  });

  it.each(['inputTokens', 'outputTokens', 'costUsdMicros'])(
    'rejects a negative %s',
    (field) => {
      const parsed = personaCostUsageSchema.safeParse({
        ...validUsage(),
        [field]: -1,
      });

      expect(parsed.success).toBe(false);
    },
  );

  it.each(['inputTokens', 'outputTokens', 'costUsdMicros'])(
    'rejects a non-integer %s',
    (field) => {
      const parsed = personaCostUsageSchema.safeParse({
        ...validUsage(),
        [field]: 1.5,
      });

      expect(parsed.success).toBe(false);
    },
  );

  it('coerces a numeric-string field to a number — pg returns BIGINT columns as strings', () => {
    const parsed = personaCostUsageSchema.safeParse({
      ...validUsage(),
      inputTokens: '120',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.inputTokens).toBe(120);
  });
});

describe('toUtcDay', () => {
  it('extracts the UTC calendar date from an ISO timestamp', () => {
    expect(toUtcDay('2026-07-17T09:00:00.000Z')).toBe('2026-07-17');
  });

  it('uses the UTC date, not a local one, near a midnight boundary', () => {
    expect(toUtcDay('2026-07-17T23:30:00.000Z')).toBe('2026-07-17');
    expect(toUtcDay('2026-07-18T00:30:00.000Z')).toBe('2026-07-18');
  });
});

describe('toUtcMonth', () => {
  it('extracts the UTC calendar month from an ISO timestamp', () => {
    expect(toUtcMonth('2026-07-17T09:00:00.000Z')).toBe('2026-07');
  });

  it('uses the UTC month, not a local one, near a month boundary', () => {
    expect(toUtcMonth('2026-07-31T23:30:00.000Z')).toBe('2026-07');
    expect(toUtcMonth('2026-08-01T00:30:00.000Z')).toBe('2026-08');
  });
});
