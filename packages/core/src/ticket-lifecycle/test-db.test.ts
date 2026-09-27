import { createRequire } from 'node:module';

import { Pool } from 'pg';
import { parse } from 'pg-connection-string';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTestPool } from './test-db.js';

// Returns the error `fn` throws, and fails the test if it doesn't throw one. Asserting on the
// result afterwards, rather than inside a `catch`, means no assertion can be swallowed by the same
// `catch` that was meant to receive the thrown error.
function errorThrownBy(fn: () => unknown): Error {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('expected an Error instance to be thrown', {
      cause: error,
    });
  }
  throw new Error('expected the function to throw');
}

// Built at runtime so the fixture never looks like a committed credential to a secret scanner.
const FAKE_PASSWORD = ['s3cret', 'pw'].join('-');

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
      `postgres://moe:${FAKE_PASSWORD}@ep-example-pooler.eu-west-2.aws.neon.tech:5432/moe`,
    );
    expect(() => getTestPool()).toThrow(
      /DATABASE_URL must point at a local Postgres/,
    );
    const error = errorThrownBy(() => getTestPool());
    expect(error.message).not.toContain(FAKE_PASSWORD);
    expect(error.message).not.toContain('ep-example-pooler');
    expect(error.message).not.toContain('neon.tech');
    expect(error.cause).toBeUndefined();
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

  // All four must be refused: the suffixed pair pins the allowlist against a prefix/substring
  // regression, `LOCALHOST` against case-folding, and `[::1]` against widening the allowlist.
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
    const error = errorThrownBy(() => getTestPool());
    expect(error.message).not.toContain(unparseable);
    expect(error.message).not.toContain('user:pw');
    expect(error.message).not.toContain('host:port');
    expect(error.cause).toBeUndefined();
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

  // The guard is only sound if `parseHost()` runs the connection string through the same
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
