import { describe, expect, it } from 'vitest';

import { parsePgEnvFromConnectionString } from './pg-env-from-connection-string.js';

describe('parsePgEnvFromConnectionString', () => {
  it('extracts host/port/user/password/database as discrete PG* values, never a combined URI', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://myuser:my%40pass@ep-abc-123.eu-west-2.aws.neon.tech:5432/moe_dev?sslmode=require',
    );
    expect(result).toEqual({
      PGHOST: 'ep-abc-123.eu-west-2.aws.neon.tech',
      PGPORT: '5432',
      PGUSER: 'myuser',
      PGPASSWORD: 'my@pass',
      PGDATABASE: 'moe_dev',
      PGSSLMODE: 'require',
    });
  });

  it('defaults PGPORT to 5432 when the connection string omits a port', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://postgres:password@localhost/moe_dev',
    );
    expect(result.PGPORT).toBe('5432');
  });

  it('omits PGSSLMODE when the connection string has no sslmode query param', () => {
    const result = parsePgEnvFromConnectionString(
      'postgres://postgres:password@localhost:5432/moe_dev',
    );
    expect(result.PGSSLMODE).toBeUndefined();
  });
});
