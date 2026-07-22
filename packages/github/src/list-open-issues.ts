import type { Octokit } from 'octokit';

import { z } from 'zod';

// GitHub's own Issues REST API returns pull requests too (a PR is a superset of an issue in
// GitHub's data model) — the only reliable signal distinguishing the two is the presence of a
// `pull_request` key, so it's validated (loosely, as "present or absent") rather than ignored,
// then filtered on below. Only the fields this module actually reads are validated — not GitHub's
// full issue payload — per `docs/CONVENTIONS.md`'s "schema-validate all API responses" rule.
const githubIssueResponseSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  html_url: z.string().min(1),
  state: z.enum(['open', 'closed']),
  updated_at: z.string().min(1),
  pull_request: z.unknown().optional(),
});

export type OpenIssue = {
  readonly issueNumber: number;
  readonly title: string;
  readonly url: string;
  readonly state: 'open' | 'closed';
  readonly githubUpdatedAt: Date;
};

export type ListOpenIssuesResult =
  | { readonly ok: true; readonly issues: readonly OpenIssue[] }
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
 * Lists every open issue in `repo` (BUILD_PLAN 4.2), pull requests filtered out. Uses Octokit's
 * own `paginate` (not a raw single-page `issues.listForRepo` call) since a repo's open-issue count
 * can exceed one page — `docs/CONVENTIONS.md`'s External API Integration Patterns section has no
 * existing pagination precedent to follow, so this establishes one: delegate to the SDK's own
 * pagination rather than hand-rolling a page-cursor loop.
 */
export async function listOpenIssues(
  client: Octokit,
  repo: { readonly owner: string; readonly name: string },
): Promise<ListOpenIssuesResult> {
  try {
    const rawIssues = await client.paginate(client.rest.issues.listForRepo, {
      owner: repo.owner,
      repo: repo.name,
      state: 'open',
      per_page: 100,
    });

    const parsed = z.array(githubIssueResponseSchema).safeParse(rawIssues);
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

    const issues = parsed.data
      .filter((issue) => issue.pull_request === undefined)
      .map((issue) => ({
        issueNumber: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        githubUpdatedAt: new Date(issue.updated_at),
      }));

    return { ok: true, issues };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
