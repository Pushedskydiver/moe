import type { Octokit } from 'octokit';

import { z } from 'zod';

// Only the two fields this module actually reads out of GitHub's full issue payload — per
// `docs/CONVENTIONS.md`'s "schema-validate all API responses" rule, same minimal-field precedent
// `list-open-issues.ts`'s own response schema sets.
const createdGithubIssueResponseSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.string().min(1),
});

export type CreatedGithubIssue = {
  readonly issueNumber: number;
  readonly url: string;
};

export type CreateGithubIssueParams = {
  readonly title: string;
  readonly body: string;
};

export type CreateGithubIssueResult =
  | { readonly ok: true; readonly issue: CreatedGithubIssue }
  | {
      readonly ok: false;
      readonly error:
        | {
            readonly kind: 'invalid-response';
            readonly issues: readonly string[];
          }
        | { readonly kind: 'unknown'; readonly cause: unknown };
    };

/**
 * Creates a real GitHub issue in `repo` (BUILD_PLAN 4.4b) — the plan's first GitHub _write_.
 * Requires the App's installation to actually grant "Issues: Read and write" (chunk 4.1's
 * original posture was read-only); a `403` from GitHub surfaces here as an ordinary `unknown`
 * error, same as any other request failure — this function doesn't special-case it, since the
 * caller (`apps/server`'s orchestration) treats every creation failure identically (release the
 * pending claim, log, move on).
 */
export async function createGithubIssue(
  client: Octokit,
  repo: { readonly owner: string; readonly name: string },
  params: CreateGithubIssueParams,
): Promise<CreateGithubIssueResult> {
  try {
    const response = await client.rest.issues.create({
      owner: repo.owner,
      repo: repo.name,
      title: params.title,
      body: params.body,
    });

    const parsed = createdGithubIssueResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          kind: 'invalid-response',
          issues: parsed.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`,
          ),
        },
      };
    }

    return {
      ok: true,
      issue: { issueNumber: parsed.data.number, url: parsed.data.html_url },
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
