import type { Logger } from './logger.js';
import type {
  NewTicketGithubIssueLinkClaim,
  PersonaId,
  ReleaseResult,
  ResolvedTicketGithubIssue,
  TicketGithubIssueLinkClaimResult,
  TicketGithubIssueLinkListResult,
  TicketGithubIssueLinkResolveResult,
  TicketsWithoutGithubIssueLinkResult,
  TicketWithoutGithubIssueLink,
} from '@moe/core';
import type {
  CreateGithubIssueParams,
  CreateGithubIssueResult,
} from '@moe/github';

import { composeExternalPostBody } from '@moe/github';

import { repositoryErrorMessage } from './repository-error.js';

// A standalone-script-scoped DI seam, same reasoning `discover-github-issues.ts`'s own
// `DiscoverGithubIssuesDeps` TSDoc gives — this is the outbound-write counterpart to that
// inbound-discovery poll, and shares none of its own DI surface with any live message/reaction
// handler.
export type CreateGithubIssuesForTicketsDeps = {
  readonly logger: Logger;
  readonly personaId: PersonaId;
  readonly repo: { readonly owner: string; readonly name: string };
  readonly githubClient: {
    readonly createIssue: (
      params: CreateGithubIssueParams,
    ) => Promise<CreateGithubIssueResult>;
  };
  readonly linkStore: {
    readonly listUnlinkedTickets: () => Promise<TicketsWithoutGithubIssueLinkResult>;
    readonly listStuckPending: () => Promise<TicketGithubIssueLinkListResult>;
    readonly claim: (
      input: NewTicketGithubIssueLinkClaim,
    ) => Promise<TicketGithubIssueLinkClaimResult>;
    readonly resolve: (
      ticketId: string,
      resolved: ResolvedTicketGithubIssue,
    ) => Promise<TicketGithubIssueLinkResolveResult>;
    readonly release: (ticketId: string) => Promise<ReleaseResult>;
  };
};

function createIssueErrorMessage(
  error: Extract<CreateGithubIssueResult, { readonly ok: false }>['error'],
): string {
  return error.kind === 'invalid-response'
    ? error.issues.join('; ')
    : String(error.cause);
}

// Extracted purely to stay under `max-lines-per-function` — an already-claimed ticket (a race, or
// a prior run's leftover claim) is expected, ordinary flow, logged as `info`; any other claim
// failure is a real repository error, logged as `error`.
function logClaimFailure(
  deps: CreateGithubIssuesForTicketsDeps,
  ticket: TicketWithoutGithubIssueLink,
  error: Extract<
    TicketGithubIssueLinkClaimResult,
    { readonly ok: false }
  >['error'],
): void {
  if (error.kind === 'already-claimed') {
    deps.logger.info('ticket already claimed for issue creation', {
      ticketId: ticket.id,
    });
    return;
  }
  deps.logger.error('failed to claim ticket for issue creation', {
    ticketId: ticket.id,
    errorMessage: repositoryErrorMessage(error),
  });
}

/**
 * Claims, creates, and links a single ticket's GitHub issue — the claim-first idempotency guard
 * Alex confirmed via `AskUserQuestion` (BUILD_PLAN 4.4b): a real GitHub issue and its DB link are
 * two separate operations that can't share a transaction, so the claim (inserted before the
 * GitHub call) is what stops a crash between them from producing a duplicate issue on retry, not
 * the eventual resolve/release below. An already-claimed ticket (a race, or a prior run's
 * leftover claim `listTicketsWithoutGithubIssueLink` didn't yet see) is skipped, not retried.
 */
async function createIssueForTicket(
  deps: CreateGithubIssuesForTicketsDeps,
  ticket: TicketWithoutGithubIssueLink,
): Promise<void> {
  const claimed = await deps.linkStore.claim({
    ticketId: ticket.id,
    repoOwner: deps.repo.owner,
    repoName: deps.repo.name,
  });
  if (!claimed.ok) {
    logClaimFailure(deps, ticket, claimed.error);
    return;
  }

  const body = composeExternalPostBody({
    personaId: deps.personaId,
    body: `Tracked as a Moe ticket (\`${ticket.id}\`), created via chat intake.`,
  });

  const created = await deps.githubClient.createIssue({
    title: ticket.title,
    body,
  });
  if (!created.ok) {
    // GitHub confirmed no issue was created (a definitive response, not a crash/timeout) —
    // release the claim so a future run retries this ticket cleanly instead of being
    // permanently blocked by an orphaned pending row.
    await deps.linkStore.release(ticket.id);
    deps.logger.error('failed to create github issue for ticket', {
      ticketId: ticket.id,
      errorMessage: createIssueErrorMessage(created.error),
    });
    return;
  }

  const resolved = await deps.linkStore.resolve(ticket.id, {
    issueNumber: created.issue.issueNumber,
    issueUrl: created.issue.url,
  });
  if (!resolved.ok) {
    // The issue is real on GitHub now — do NOT release the claim here (that would let a future
    // run create a second, duplicate issue for the same ticket). A documented, accepted
    // residual gap: the claim-then-act fallback fix's own "external call sits between claim and
    // final write" shape (`docs/GLOSSARY.md`), which can't be closed by a DB transaction either.
    deps.logger.error(
      'github issue created but failed to persist the ticket-github issue link — a real GitHub issue now exists with no DB record pointing at it',
      {
        ticketId: ticket.id,
        issueNumber: created.issue.issueNumber,
        issueUrl: created.issue.url,
      },
    );
  }
}

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — matches `discover-github-issues.ts`'s own `upsertIssues` precedent for
// sequential-by-design async work over a short list. One ticket's failure logs and moves on to
// the next rather than aborting the whole run.
async function createIssuesForTickets(
  deps: CreateGithubIssuesForTicketsDeps,
  tickets: readonly TicketWithoutGithubIssueLink[],
): Promise<void> {
  const [ticket, ...rest] = tickets;
  if (ticket === undefined) return;

  await createIssueForTicket(deps, ticket);
  await createIssuesForTickets(deps, rest);
}

/**
 * BUILD_PLAN 4.4b's own outbound issue-creation run — the plan's first GitHub _write_. Triggered
 * manually (same no-scheduled-job-infrastructure precedent `discover-github-issues.ts`/
 * `review-queue-sweep.ts` already established, Alex confirmed via `AskUserQuestion`): scans every
 * ticket without a linked GitHub issue and creates one for each. Checks for stuck-`pending` claims
 * first (a prior run's process crash between claiming and resolving/releasing) and surfaces them
 * for manual reconciliation — deliberately never auto-retried, since this codebase can't tell
 * whether that prior claim's GitHub call actually succeeded without querying GitHub directly.
 */
export async function createGithubIssuesForTickets(
  deps: CreateGithubIssuesForTicketsDeps,
): Promise<void> {
  const stuck = await deps.linkStore.listStuckPending();
  if (!stuck.ok) {
    deps.logger.error(
      'failed to check for stuck pending github-issue-creation claims',
      { errorMessage: repositoryErrorMessage(stuck.error) },
    );
  } else if (stuck.links.length > 0) {
    deps.logger.error(
      'tickets stuck with an unresolved github-issue-creation claim — needs manual reconciliation',
      { ticketIds: stuck.links.map((link) => link.ticketId) },
    );
  }

  const unlinked = await deps.linkStore.listUnlinkedTickets();
  if (!unlinked.ok) {
    deps.logger.error('failed to list tickets without a linked github issue', {
      errorMessage: repositoryErrorMessage(unlinked.error),
    });
    return;
  }

  await createIssuesForTickets(deps, unlinked.tickets);
  deps.logger.info('github issue creation complete', {
    ticketCount: unlinked.tickets.length,
  });
}
