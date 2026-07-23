import type { Octokit } from 'octokit';

import { z } from 'zod';

// Only the two fields this module actually reads out of GitHub's full issue payload — per
// `docs/CONVENTIONS.md`'s "schema-validate all API responses" rule, same minimal-field precedent
// `list-open-issues.ts`/`create-github-issue.ts`'s own response schemas set.
const githubIssueStateResponseSchema = z.object({
  number: z.number().int().positive(),
  state: z.enum(['open', 'closed']),
});

export type GithubIssueState = {
  readonly issueNumber: number;
  readonly state: 'open' | 'closed';
};

export type GetGithubIssueStateResult =
  | { readonly ok: true; readonly issue: GithubIssueState }
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
 * Fetches a single issue's current state by number (BUILD_PLAN 4.4c's reconciliation poll) — a
 * per-issue lookup rather than `list-open-issues.ts`'s own bulk `paginate` call, since
 * reconciliation already knows exactly which issue numbers it needs (from
 * `ticket_github_issue_links`'s resolved rows) and needs each one's precise current state,
 * including an issue that's closed (bulk discovery only ever lists open ones) — a bulk diff
 * couldn't distinguish "still open" from "reopened after being closed" without fetching closed
 * issues too, which `list-open-issues.ts` deliberately doesn't do.
 */
export async function getGithubIssueState(
  client: Octokit,
  repo: { readonly owner: string; readonly name: string },
  issueNumber: number,
): Promise<GetGithubIssueStateResult> {
  try {
    const response = await client.rest.issues.get({
      owner: repo.owner,
      repo: repo.name,
      issue_number: issueNumber,
    });

    const parsed = githubIssueStateResponseSchema.safeParse(response.data);
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
      issue: { issueNumber: parsed.data.number, state: parsed.data.state },
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
