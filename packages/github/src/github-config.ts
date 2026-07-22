import { z } from 'zod';

// One env var, not two — the installation this App is scoped to already covers exactly one repo
// (`repository_selection: "selected"`, confirmed live), matching moe's own single-project posture
// (`docs/VISION.md` §3.4 defers multi-project support). `ctx.addIssue` + `z.NEVER` rather than a
// `.refine()` after a lossy split, so a malformed value (no slash, more than one, an empty half)
// fails loudly instead of silently truncating to whatever the first two parts happened to be.
const githubRepoSchema = z
  .string()
  .min(1)
  .transform((raw, ctx) => {
    const parts = raw.split('/');
    const [owner, name] = parts;
    if (
      parts.length !== 2 ||
      owner === undefined ||
      name === undefined ||
      owner === '' ||
      name === '' ||
      /\s/.test(owner) ||
      /\s/.test(name)
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'must be exactly "owner/name" (a single slash, both parts non-empty, no whitespace)',
      });
      return z.NEVER;
    }
    return { owner, name };
  });

const githubConfigSchema = z.object({
  appId: z.string().min(1),
  privateKey: z.string().min(1),
  installationId: z.coerce.number().int().positive(),
  repo: githubRepoSchema,
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
    repo: env.MOE_GITHUB_REPO,
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
