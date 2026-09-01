import type { Octokit } from 'octokit';

import { z } from 'zod';

// Only the three fields this module actually reads out of GitHub's full issue payload — per
// `docs/CONVENTIONS.md`'s "schema-validate all API responses" rule, same minimal-field precedent
// `get-github-issue-state.ts`'s own response schema sets. `body` is nullable — GitHub returns
// `null` for an issue with no description, not an empty string.
const githubIssueBodyResponseSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().nullable(),
});

export type GithubIssueBody = {
  readonly issueNumber: number;
  readonly title: string;
  readonly body: string;
};

export type GetGithubIssueBodyResult =
  | { readonly ok: true; readonly issue: GithubIssueBody }
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
 * Fetches a single issue's current title/body by number — BUILD_PLAN 6.1b's own content source
 * for a triage-queue-converted ticket's brief: `github-issue-triage-entry.ts`'s own table is
 * deliberately minimal (a pointer, not the full body), so a persona composing a brief for a
 * GitHub-triage-sourced ticket fetches the current body fresh here rather than risking a stale
 * cached copy. Mirrors `get-github-issue-state.ts`'s own per-issue `issues.get` lookup shape — a
 * different field slice off the identical response, not a different call. A `null` body (an
 * issue with no description) normalizes to `''`, same "no invented content" discipline
 * `compose-brief.ts`'s own system prompt relies on downstream.
 */
export async function getGithubIssueBody(
  client: Octokit,
  repo: { readonly owner: string; readonly name: string },
  issueNumber: number,
): Promise<GetGithubIssueBodyResult> {
  try {
    const response = await client.rest.issues.get({
      owner: repo.owner,
      repo: repo.name,
      issue_number: issueNumber,
    });

    const parsed = githubIssueBodyResponseSchema.safeParse(response.data);
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
      issue: {
        issueNumber: parsed.data.number,
        title: parsed.data.title,
        body: parsed.data.body ?? '',
      },
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
