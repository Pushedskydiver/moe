import { describe, expect, it } from 'vitest';

import { parsePgEnvFromConnectionString } from './pg-env-from-connection-string.js';

describe('parsePgEnvFromConnectionString', () => {
  it('extracts host/port/user/password/database as discrete PG* values, never a combined URI', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://myuser:my%40pass@ep-abc-123.eu-west-2.aws.neon.tech:5432/moe_dev?sslmode=require',
    );
    expect(result).toEqual({
      ok: true,
      env: {
        PGHOST: 'ep-abc-123.eu-west-2.aws.neon.tech',
        PGPORT: '5432',
        PGUSER: 'myuser',
        PGPASSWORD: 'my@pass',
        PGDATABASE: 'moe_dev',
        PGSSLMODE: 'require',
      },
    });
  });

  it('defaults PGPORT to 5432 when the connection string omits a port', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://postgres:password@localhost/moe_dev',
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.env.PGPORT).toBe('5432');
  });

  it('omits PGSSLMODE when the connection string has no sslmode query param', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://postgres:password@localhost:5432/moe_dev',
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.env.PGSSLMODE).toBeUndefined();
  });

  it('returns ok:false rather than throwing when the value is not a URL at all', () => {
    const result = parsePgEnvFromConnectionString('not-a-connection-string');
    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalid-connection-string', message: expect.any(String) },
    });
  });

  it('returns ok:false rather than throwing on malformed percent-encoding in the password', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://user:my%pass@localhost:5432/db',
    );
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when a decoded field contains an embedded newline (env-file injection)', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://user:my%0Apass@localhost:5432/db',
    );
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when sslmode decodes to a value containing an embedded newline', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://user:pass@localhost:5432/db?sslmode=require%0AEXTRA=evil',
    );
    expect(result.ok).toBe(false);
  });
});
