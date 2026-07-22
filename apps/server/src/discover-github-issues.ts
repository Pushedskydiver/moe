import type { Logger } from './logger.js';
import type {
  GithubIssueTriageEntryResult,
  NewGithubIssueTriageEntry,
} from '@moe/core';
import type { ListOpenIssuesResult, OpenIssue } from '@moe/github';

function listOpenIssuesErrorMessage(
  error: Extract<ListOpenIssuesResult, { readonly ok: false }>['error'],
): string {
  return error.kind === 'invalid-response'
    ? error.issues.join('; ')
    : String(error.cause);
}

// A standalone-script-scoped DI seam, same reasoning `review-queue-sweep.ts`'s own `SweepDeps`
// TSDoc gives: `listOpenIssues`/`upsert` aren't part of any live message/reaction handler's own
// DI surface, so widening a shared type would leak a discovery-only concern into it.
export type DiscoverGithubIssuesDeps = {
  readonly logger: Logger;
  readonly repo: { readonly owner: string; readonly name: string };
  readonly githubClient: {
    readonly listOpenIssues: (repo: {
      readonly owner: string;
      readonly name: string;
    }) => Promise<ListOpenIssuesResult>;
  };
  readonly triageStore: {
    readonly upsert: (
      input: NewGithubIssueTriageEntry,
    ) => Promise<GithubIssueTriageEntryResult>;
  };
};

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — matches `check-cost-cap.ts`'s `sendCostAlerts`/`review-queue-sweep.ts`'s own
// `logStaleQuestionsAsSilent` precedent for sequential-by-design async work over a short list. One
// issue's upsert failing logs and moves on to the next rather than aborting the whole poll — an
// isolated write failure shouldn't cost every other issue this run would otherwise have recorded.
async function upsertIssues(
  deps: DiscoverGithubIssuesDeps,
  issues: readonly OpenIssue[],
  polledAt: Date,
): Promise<void> {
  const [issue, ...rest] = issues;
  if (issue === undefined) return;

  const result = await deps.triageStore.upsert({
    repoOwner: deps.repo.owner,
    repoName: deps.repo.name,
    issueNumber: issue.issueNumber,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    githubUpdatedAt: issue.githubUpdatedAt,
    polledAt,
  });
  if (!result.ok) {
    deps.logger.error('failed to upsert github issue triage entry', {
      issueNumber: issue.issueNumber,
      // Not `message:` — that field name collides with `logger.ts`'s own reserved `message` key
      // (`writeLine`'s own "caller fields spread first" comment/test: a field literally named
      // `message` is always overwritten by the log call's own top-level message string, silently
      // discarding whatever the caller put there). A real, confirmed bug in this exact shape at
      // 44 other call sites repo-wide, all fixed in this same PR — see `logger.ts`'s own TSDoc.
      errorMessage:
        result.error.kind === 'validation-failed'
          ? result.error.issues
          : String(result.error.cause),
    });
  }

  await upsertIssues(deps, rest, polledAt);
}

/**
 * BUILD_PLAN 4.2's own issue-discovery poll. Triggered manually (Alex confirmed via
 * `AskUserQuestion`: a CLI script, `scripts/discover-github-issues.ts`'s own thin real-infra
 * wrapper around this function — same no-scheduled-job-infrastructure precedent
 * `review-queue-sweep.ts`'s own TSDoc gives). Lists every open issue in `deps.repo` and upserts
 * each into the `github_issue_triage` table (BUILD_PLAN 6.1b's future consumer). A listing
 * failure logs and returns without writing anything — there's nothing partial to salvage from a
 * single failed list call, unlike the per-issue upsert loop below it.
 */
export async function discoverGithubIssues(
  deps: DiscoverGithubIssuesDeps,
  now: Date,
): Promise<void> {
  const listed = await deps.githubClient.listOpenIssues(deps.repo);
  if (!listed.ok) {
    deps.logger.error('failed to list open github issues', {
      repoOwner: deps.repo.owner,
      repoName: deps.repo.name,
      errorMessage: listOpenIssuesErrorMessage(listed.error),
    });
    return;
  }

  await upsertIssues(deps, listed.issues, now);
  deps.logger.info('github issue discovery complete', {
    repoOwner: deps.repo.owner,
    repoName: deps.repo.name,
    issueCount: listed.issues.length,
  });
}
