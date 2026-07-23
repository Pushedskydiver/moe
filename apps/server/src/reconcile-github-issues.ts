import type { Logger } from './logger.js';
import type {
  BoardStatus,
  Ticket,
  TicketGithubIssueLinkListResult,
  TicketOrNullResult,
} from '@moe/core';
import type { GetGithubIssueStateResult } from '@moe/github';

import { repositoryErrorMessage } from './repository-error.js';

type ResolvedTicketGithubIssueLink = Extract<
  TicketGithubIssueLinkListResult,
  { readonly ok: true }
>['links'][number];

type IssueRef = { readonly issueNumber: number; readonly issueUrl: string };

// What actually happened to one link — logged in aggregate by `reconcileGithubIssues` so the
// final summary reflects real outcomes, not just the candidate count (`docs/DA-REVIEW.md`'s named
// anti-pattern: "if operations can be skipped, track successes, not the input list").
type ReconcileOutcome =
  'cancelled' | 'reopened-notice' | 'no-op' | 'skipped-done' | 'error';

// A standalone-script-scoped DI seam, same reasoning `create-github-issues-for-tickets.ts`'s own
// `CreateGithubIssuesForTicketsDeps` TSDoc gives — this reconciliation poll shares none of its own
// DI surface with any live message/reaction handler.
export type ReconcileGithubIssuesDeps = {
  readonly logger: Logger;
  readonly repo: { readonly owner: string; readonly name: string };
  readonly githubClient: {
    readonly getIssueState: (
      issueNumber: number,
    ) => Promise<GetGithubIssueStateResult>;
  };
  readonly linkStore: {
    readonly listResolved: () => Promise<TicketGithubIssueLinkListResult>;
  };
  readonly ticketStore: {
    readonly getById: (id: string) => Promise<TicketOrNullResult>;
    readonly update: (
      id: string,
      patch: { readonly status: BoardStatus },
    ) => Promise<TicketOrNullResult>;
  };
};

// The statuses this poll treats as "real work may already be in progress" — Alex confirmed via
// `AskUserQuestion` (BUILD_PLAN 4.4c) that closure still cancels regardless (withholding the
// status change would leave the board silently out of sync with GitHub, the exact divergence this
// poll exists to close), but logs at `warn` rather than `info` so it's noticed, not silently
// folded into the routine Backlog/Brief/Plan case.
const IN_PROGRESS_STATUSES: readonly BoardStatus[] = ['Build', 'Review'];

function getIssueStateErrorMessage(
  error: Extract<GetGithubIssueStateResult, { readonly ok: false }>['error'],
): string {
  return error.kind === 'invalid-response'
    ? error.issues.join('; ')
    : String(error.cause);
}

// `issueNumber`/`issueUrl` are only nullable in `ticketGithubIssueLinkSchema` because a *pending*
// claim hasn't heard back from GitHub yet — `resolveTicketGithubIssueLink` always sets both
// together with `resolvedAt`, so a row `listResolvedTicketGithubIssueLinks` returns (filtered on
// `resolvedAt IS NOT NULL`) never actually has either as null. Checked here defensively rather
// than asserted, since the type system can't express that correlation.
function resolveIssueRef(
  deps: ReconcileGithubIssuesDeps,
  link: ResolvedTicketGithubIssueLink,
): IssueRef | null {
  if (link.issueNumber === null || link.issueUrl === null) {
    deps.logger.error(
      'resolved github issue link is missing its issue number/url — a data integrity violation',
      { ticketId: link.ticketId },
    );
    return null;
  }
  return { issueNumber: link.issueNumber, issueUrl: link.issueUrl };
}

async function lookUpTicket(
  deps: ReconcileGithubIssuesDeps,
  ticketId: string,
): Promise<Ticket | null> {
  const ticketResult = await deps.ticketStore.getById(ticketId);
  if (!ticketResult.ok) {
    deps.logger.error(
      'failed to look up ticket during github issue reconciliation',
      { ticketId, errorMessage: repositoryErrorMessage(ticketResult.error) },
    );
    return null;
  }
  if (!ticketResult.ticket) {
    deps.logger.error(
      'resolved github issue link points at a ticket that no longer exists',
      { ticketId },
    );
    return null;
  }
  return ticketResult.ticket;
}

// Extracted purely to stay under `max-lines-per-function`.
async function cancelClosedTicket(
  deps: ReconcileGithubIssuesDeps,
  options: {
    readonly ticketId: string;
    readonly previousStatus: BoardStatus;
    readonly issueNumber: number;
    readonly issueUrl: string;
  },
): Promise<ReconcileOutcome> {
  const { ticketId, previousStatus, issueNumber, issueUrl } = options;
  const updated = await deps.ticketStore.update(ticketId, {
    status: 'Cancelled',
  });
  if (!updated.ok) {
    deps.logger.error(
      'failed to cancel ticket after its linked github issue closed',
      {
        ticketId,
        issueNumber,
        errorMessage: repositoryErrorMessage(updated.error),
      },
    );
    return 'error';
  }

  const logFields = { ticketId, issueNumber, issueUrl, previousStatus };
  if (IN_PROGRESS_STATUSES.includes(previousStatus)) {
    deps.logger.warn(
      'cancelled a ticket with real work potentially in progress — its linked github issue was closed externally',
      logFields,
    );
  } else {
    deps.logger.info(
      'cancelled ticket — its linked github issue was closed externally',
      logFields,
    );
  }
  return 'cancelled';
}

// Alex confirmed via `AskUserQuestion` (BUILD_PLAN 4.4c): `Cancelled` stays terminal even after a
// reopen — VISION calls it "a non-flow terminal state," so this poll never auto-reverses it, only
// logs for a human to manually re-triage into a fresh ticket if the work should actually resume.
function noticeIfReopened(
  deps: ReconcileGithubIssuesDeps,
  ticket: Ticket,
  ref: IssueRef,
): ReconcileOutcome {
  if (ticket.status !== 'Cancelled') return 'no-op';
  deps.logger.warn('linked github issue reopened after ticket was cancelled', {
    ticketId: ticket.id,
    issueNumber: ref.issueNumber,
    issueUrl: ref.issueUrl,
  });
  return 'reopened-notice';
}

async function reconcileClosedIssue(
  deps: ReconcileGithubIssuesDeps,
  ticket: Ticket,
  ref: IssueRef,
): Promise<ReconcileOutcome> {
  if (ticket.status === 'Cancelled') return 'no-op'; // already reconciled
  return cancelClosedTicket(deps, {
    ticketId: ticket.id,
    previousStatus: ticket.status,
    issueNumber: ref.issueNumber,
    issueUrl: ref.issueUrl,
  });
}

/**
 * Reconciles one resolved link against its GitHub issue's current state (BUILD_PLAN 4.4c). Three
 * outcomes decided with Alex via `AskUserQuestion` before any code moved: any closure maps to
 * `Cancelled` regardless of GitHub's `state_reason` (nothing in moe closes issues via its own
 * workflow today, so every closure this poll sees is genuinely external); a reopened issue leaves
 * an already-`Cancelled` ticket cancelled (see `noticeIfReopened`); and closure still cancels a
 * ticket already in `Build`/`Review`. A `Done` ticket is skipped outright (no GitHub call at all)
 * — it's the terminal *success* state, and its issue being closed is expected, not an
 * external-cancellation signal to reflect.
 */
async function reconcileLink(
  deps: ReconcileGithubIssuesDeps,
  link: ResolvedTicketGithubIssueLink,
): Promise<ReconcileOutcome> {
  const ref = resolveIssueRef(deps, link);
  if (!ref) return 'error';

  const ticket = await lookUpTicket(deps, link.ticketId);
  if (!ticket) return 'error';

  if (ticket.status === 'Done') return 'skipped-done';

  const state = await deps.githubClient.getIssueState(ref.issueNumber);
  if (!state.ok) {
    deps.logger.error(
      'failed to fetch github issue state during reconciliation',
      {
        ticketId: ticket.id,
        issueNumber: ref.issueNumber,
        errorMessage: getIssueStateErrorMessage(state.error),
      },
    );
    return 'error';
  }

  if (state.issue.state === 'open') {
    return noticeIfReopened(deps, ticket, ref);
  }

  return reconcileClosedIssue(deps, ticket, ref);
}

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — matches `create-github-issues-for-tickets.ts`'s own `createIssuesForTickets`
// precedent for sequential-by-design async work over a short list. One link's failure logs and
// moves on to the next rather than aborting the whole run; each outcome is accumulated so the
// final summary reflects what actually happened, not just how many links were candidates.
async function reconcileLinks(
  deps: ReconcileGithubIssuesDeps,
  links: readonly ResolvedTicketGithubIssueLink[],
): Promise<readonly ReconcileOutcome[]> {
  const [link, ...rest] = links;
  if (link === undefined) return [];

  const outcome = await reconcileLink(deps, link);
  return [outcome, ...(await reconcileLinks(deps, rest))];
}

function countOutcomes(
  outcomes: readonly ReconcileOutcome[],
): Record<ReconcileOutcome, number> {
  return {
    cancelled: outcomes.filter((o) => o === 'cancelled').length,
    'reopened-notice': outcomes.filter((o) => o === 'reopened-notice').length,
    'no-op': outcomes.filter((o) => o === 'no-op').length,
    'skipped-done': outcomes.filter((o) => o === 'skipped-done').length,
    error: outcomes.filter((o) => o === 'error').length,
  };
}

/**
 * BUILD_PLAN 4.4c's own reconciliation poll — closes the loop chunk 4.4b opened. Triggered
 * manually (same no-scheduled-job-infrastructure precedent `discover-github-issues.ts`/
 * `create-github-issues-for-tickets.ts` already established): checks every resolved
 * ticket↔GitHub-issue link's current GitHub state and reflects an external closure as `Cancelled`
 * on the linked ticket. Purely an internal DB status change — no external post, so `4.4a`'s
 * attribution/footer composer has no call site here (unlike `4.4b`'s issue-body write).
 *
 * No `standing-proactive-guards.ts` check here, deliberately — same reasoning
 * `create-github-issues-for-tickets.ts`'s own TSDoc gives: this only runs because Alex personally
 * triggered it, not a persona acting unprompted.
 */
export async function reconcileGithubIssues(
  deps: ReconcileGithubIssuesDeps,
): Promise<void> {
  const resolved = await deps.linkStore.listResolved();
  if (!resolved.ok) {
    deps.logger.error(
      'failed to list resolved github issue links for reconciliation',
      { errorMessage: repositoryErrorMessage(resolved.error) },
    );
    return;
  }

  const outcomes = await reconcileLinks(deps, resolved.links);
  deps.logger.info('github issue reconciliation complete', {
    linkCount: resolved.links.length,
    ...countOutcomes(outcomes),
  });
}
