import { z } from 'zod';

const githubConfigSchema = z.object({
  appId: z.string().min(1),
  privateKey: z.string().min(1),
  installationId: z.coerce.number().int().positive(),
});

export type GithubConfig = z.infer<typeof githubConfigSchema>;

export type ParseGithubConfigResult =
  | { readonly ok: true; readonly config: GithubConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-config';
        readonly issues: readonly string[];
      };
    };

/**
 * Pure boundary parser — takes an env-shaped record (the caller reads `process.env`, this
 * function never does) and validates it into a `GithubConfig`. Same
 * `parsePersonaConfig`/`parseAnthropicConfig`/`parseCostCapConfig` shape and precedent.
 * `privateKey` is kept as the raw PEM string with its `\n` escapes intact — `@octokit/auth-app`
 * delegates to `universal-github-app-jwt`, which converts escaped newlines to real ones itself,
 * so this parser doesn't duplicate that step.
 */
export function parseGithubConfig(
  env: Readonly<Record<string, string | undefined>>,
): ParseGithubConfigResult {
  const parsed = githubConfigSchema.safeParse({
    appId: env.MOE_GITHUB_APP_ID,
    privateKey: env.MOE_GITHUB_PRIVATE_KEY,
    installationId: env.MOE_GITHUB_INSTALLATION_ID,
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
