import { describe, expect, it } from 'vitest';

import { parseDatabaseConfig } from './database-config.js';

describe('parseDatabaseConfig', () => {
  it('returns ok:true with a parsed config for valid env input', () => {
    const result = parseDatabaseConfig({
      DATABASE_URL: 'postgres://postgres:password@localhost:5432/moe_dev',
    });

    expect(result).toEqual({
      ok: true,
      config: {
        connectionString: 'postgres://postgres:password@localhost:5432/moe_dev',
      },
    });
  });

  it('returns ok:false when DATABASE_URL is missing', () => {
    const result = parseDatabaseConfig({});

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when DATABASE_URL is blank', () => {
    const result = parseDatabaseConfig({ DATABASE_URL: '' });

    expect(result.ok).toBe(false);
  });

  it('returns a typed, non-empty list of issues in the ok:false error channel', () => {
    const result = parseDatabaseConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-config');
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
