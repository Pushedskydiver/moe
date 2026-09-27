import { createRequire } from 'node:module';

import { Pool } from 'pg';
import { parse } from 'pg-connection-string';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTestPool } from './test-db.js';

// DA L1: captures a thrown error outside the `try` so an `expect.unreachable()` placed inside a
// `try` whose own `catch` would otherwise swallow it never happens — the assertion always runs
// against a value the `catch` block already finished populating.
function captureError(fn: () => unknown): unknown {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  return caught;
}

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
    const caught = captureError(() => getTestPool());
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain('s3cret-pw');
    expect(message).not.toContain('ep-example-pooler');
    expect(message).not.toContain('neon.tech');
    expect((caught as Error).cause).toBeUndefined();
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

  // DA M1: the allowlist is an exact string match on the host `pg-connection-string` parses out
  // — none of these should be accepted by a `startsWith`/substring check against `localhost` or
  // `127.0.0.1`. Prove-It: verified by temporarily swapping `LOCAL_TEST_HOSTS.has(host)` in
  // `isLocalTestDatabaseUrl` for `host.startsWith('localhost') || host.startsWith('127.0.0.1')`
  // and confirming the `localhost.evil.example` and `127.0.0.1.nip.io` cases below then fail to
  // throw (both start with an allowed prefix), before restoring the exact-match guard.
  it.each([
    [
      'postgres://moe:pw@localhost.evil.example:5432/moe',
      'a suffixed lookalike host',
    ],
    [
      'postgres://moe:pw@127.0.0.1.nip.io:5432/moe',
      'a suffixed lookalike host',
    ],
    ['postgres://moe:pw@[::1]:5432/moe', 'the IPv6 loopback address'],
    [
      'postgres://moe:pw@LOCALHOST:5432/moe',
      'an uppercase host (postgres: is not a scheme whose hostname pg-connection-string lowercases, and the allowlist is exact)',
    ],
  ])('refuses %s (%s)', (connectionString) => {
    vi.stubEnv('DATABASE_URL', connectionString);
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
  });

  it('refuses an unparseable connection string without leaking the input', () => {
    const unparseable = 'postgres://user:pw@host:port/db';
    expect(() => parse(unparseable)).toThrow();
    vi.stubEnv('DATABASE_URL', unparseable);
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
    const caught = captureError(() => getTestPool());
    expect((caught as Error).message).not.toContain(unparseable);
    expect((caught as Error).message).not.toContain('user:pw');
    expect((caught as Error).message).not.toContain('host:port');
    expect((caught as Error).cause).toBeUndefined();
  });

  it('returns a Pool for localhost', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:pw@localhost:5432/moe_dev');
    const pool = getTestPool();
    expect(pool).toBeInstanceOf(Pool);
    await pool.end();
  });

  it('returns a Pool for 127.0.0.1', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:pw@127.0.0.1:5432/moe_dev');
    const pool = getTestPool();
    expect(pool).toBeInstanceOf(Pool);
    await pool.end();
  });

  // DA L3: the guard is only sound if `parseHost()` runs the connection string through the same
  // `pg-connection-string` `parse` that `pg` itself connects with — if the two ever resolved to
  // different copies (a duplicate install, a version split), this guard could validate against
  // one parser's notion of "host" while `pg` actually connects using another's.
  it('resolves the same pg-connection-string module that pg itself resolves', () => {
    const require = createRequire(import.meta.url);
    const ownResolution = require.resolve('pg-connection-string');
    const pgResolution = createRequire(require.resolve('pg')).resolve(
      'pg-connection-string',
    );
    expect(ownResolution).toBe(pgResolution);
  });
});
