import { z } from 'zod';

const databaseConfigSchema = z.object({
  connectionString: z.string().min(1),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

export type ParseDatabaseConfigResult =
  | { readonly ok: true; readonly config: DatabaseConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-config';
        readonly issues: readonly string[];
      };
    };

/**
 * Pure boundary parser — takes an env-shaped record (the caller reads `process.env`, this
 * function never does) and validates it into a `DatabaseConfig`. Reads the bare `DATABASE_URL`
 * (no `MOE_` prefix), matching `packages/core/scripts/migrate.ts`'s own existing precedent and
 * `parseAnthropicConfig`'s `ANTHROPIC_API_KEY` — a widely-standard name outside moe's own
 * vocabulary.
 */
export function parseDatabaseConfig(
  env: Readonly<Record<string, string | undefined>>,
): ParseDatabaseConfigResult {
  const parsed = databaseConfigSchema.safeParse({
    connectionString: env.DATABASE_URL,
  });

  return parsed.success
    ? { ok: true, config: parsed.data }
    : {
        ok: false,
        error: {
          kind: 'invalid-config',
          issues: parsed.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`,
          ),
        },
      };
}
