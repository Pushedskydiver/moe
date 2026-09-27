import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTestPool } from './test-db.js';

describe('getTestPool', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when DATABASE_URL is not set', () => {
    vi.stubEnv('DATABASE_URL', undefined);
    expect(() => getTestPool()).toThrow('DATABASE_URL is not set');
  });

  it('refuses a remote host', () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgres://moe:s3cret-pw@ep-example-pooler.eu-west-2.aws.neon.tech:5432/moe',
    );
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
    try {
      getTestPool();
      expect.unreachable('getTestPool should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).not.toContain('s3cret-pw');
      expect(message).not.toContain('ep-example-pooler');
      expect(message).not.toContain('neon.tech');
      expect((error as Error).cause).toBeUndefined();
    }
  });

  it('refuses a `?host=` query-parameter override', () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgres://moe:pw@localhost:5432/moe?host=ep-example.neon.tech',
    );
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
  });

  it('refuses an empty host', () => {
    vi.stubEnv('DATABASE_URL', 'postgres:///moe_dev');
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
  });

  it('refuses a Unix-socket path', () => {
    vi.stubEnv('DATABASE_URL', 'socket:/var/run/postgresql?db=moe_dev');
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
  });

  it('refuses an unparseable connection string without leaking the input', () => {
    const unparseable = 'postgres://user:pw@host:port/db';
    vi.stubEnv('DATABASE_URL', unparseable);
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
    try {
      getTestPool();
      expect.unreachable('getTestPool should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain(unparseable);
    }
  });

  it('returns a Pool for localhost', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:pw@localhost:5432/moe_dev');
    const pool = getTestPool();
    await pool.end();
  });

  it('returns a Pool for 127.0.0.1', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:pw@127.0.0.1:5432/moe_dev');
    const pool = getTestPool();
    await pool.end();
  });
});
