export type PgConnectionEnv = {
  readonly PGHOST: string;
  readonly PGPORT: string;
  readonly PGUSER: string;
  readonly PGPASSWORD: string;
  readonly PGDATABASE: string;
  readonly PGSSLMODE?: string;
};

export type ParsePgEnvResult =
  | { readonly ok: true; readonly env: PgConnectionEnv }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-connection-string';
        readonly message: string;
      };
    };

const CONTROL_CHARACTER = /[\r\n\0]/;

function tryParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function tryDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function invalid(message: string): ParsePgEnvResult {
  return { ok: false, error: { kind: 'invalid-connection-string', message } };
}

/**
 * Splits a connection string into discrete `PG*` env vars rather than handing `pg_dump`/
 * `pg_restore` the whole URI via `--dbname` — a `--dbname` value is expanded by the container's
 * shell and reaches the `pg_dump`/`pg_restore` process's own argv (visible via `docker top`),
 * while these individual vars are libpq's own documented env-var mechanism and never appear in
 * any process's command-line arguments.
 *
 * Returns a `Result` rather than throwing: `DATABASE_URL` is operator-supplied input with two
 * independent ways to be malformed (not a URL at all; a URL whose credentials/database segment
 * isn't valid percent-encoding) — both are expected failures, not invariant violations. A decoded
 * field containing `\r`/`\n`/`\0` is also rejected here, before it ever reaches
 * `formatEnvFileContents` — an embedded newline in a decoded username/password/database/sslmode
 * would otherwise inject an arbitrary extra line into the generated `--env-file`.
 */
export function parsePgEnvFromConnectionString(
  connectionString: string,
): ParsePgEnvResult {
  const url = tryParseUrl(connectionString);
  if (!url) return invalid('not a valid URL');

  const username = tryDecode(url.username);
  const password = tryDecode(url.password);
  const database = tryDecode(url.pathname.replace(/^\//, ''));
  if (
    username === undefined ||
    password === undefined ||
    database === undefined
  ) {
    return invalid('contains invalid percent-encoding');
  }

  // url.hostname is deliberately included raw, not via tryDecode — WHATWG URL's opaque-host
  // parsing (postgres: is a non-special scheme) percent-encodes disallowed literal bytes but never
  // decodes an existing percent-triplet, so a control character here can only ever appear as
  // literal `%0A`-style text, not a real `\r`/`\n`/`\0` byte. Do NOT add decoding for this field to
  // "match" the other four without re-deriving this safety argument — that would silently turn
  // this check into the same env-file-injection vector it currently prevents for the rest.
  const sslmode = url.searchParams.get('sslmode');
  const decodedFields = [
    url.hostname,
    username,
    password,
    database,
    sslmode ?? '',
  ];
  if (decodedFields.some((field) => CONTROL_CHARACTER.test(field))) {
    return invalid('contains an embedded control character');
  }

  return {
    ok: true,
    env: {
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: username,
      PGPASSWORD: password,
      PGDATABASE: database,
      ...(sslmode ? { PGSSLMODE: sslmode } : {}),
    },
  };
}
