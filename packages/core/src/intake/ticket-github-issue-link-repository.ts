import type { Database } from '../schema.js';
import type { TicketGithubIssueLink } from './ticket-github-issue-link.js';
import type { Kysely } from 'kysely';

import { ticketGithubIssueLinkSchema } from './ticket-github-issue-link.js';

export type NewTicketGithubIssueLinkClaim = {
  readonly ticketId: string;
  readonly repoOwner: string;
  readonly repoName: string;
};

export type ResolvedTicketGithubIssue = {
  readonly issueNumber: number;
  readonly issueUrl: string;
};

export type TicketGithubIssueLinkRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type TicketGithubIssueLinkResult =
  | { readonly ok: true; readonly link: TicketGithubIssueLink }
  | {
      readonly ok: false;
      readonly error: TicketGithubIssueLinkRepositoryError;
    };

export type TicketGithubIssueLinkOrNullResult =
  | { readonly ok: true; readonly link: TicketGithubIssueLink | null }
  | {
      readonly ok: false;
      readonly error: TicketGithubIssueLinkRepositoryError;
    };

export type TicketGithubIssueLinkListResult =
  | { readonly ok: true; readonly links: readonly TicketGithubIssueLink[] }
  | {
      readonly ok: false;
      readonly error: TicketGithubIssueLinkRepositoryError;
    };

// `'already-claimed'`/`'unavailable'` are specific to this file's own atomic-claim/resolve
// semantics — scoped to their own result types rather than widening
// `TicketGithubIssueLinkRepositoryError`, same reasoning `pending-ticket-drafts-repository.ts`'s
// own `PendingTicketDraftClaimError` gives.
export type TicketGithubIssueLinkClaimError =
  TicketGithubIssueLinkRepositoryError | { readonly kind: 'already-claimed' };

export type TicketGithubIssueLinkClaimResult =
  | { readonly ok: true; readonly link: TicketGithubIssueLink }
  | { readonly ok: false; readonly error: TicketGithubIssueLinkClaimError };

export type TicketGithubIssueLinkResolveError =
  TicketGithubIssueLinkRepositoryError | { readonly kind: 'unavailable' };

export type TicketGithubIssueLinkResolveResult =
  | { readonly ok: true; readonly link: TicketGithubIssueLink }
  | {
      readonly ok: false;
      readonly error: TicketGithubIssueLinkResolveError;
    };

export type ReleaseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly cause: unknown } };

export type TicketWithoutGithubIssueLink = {
  readonly id: string;
  readonly title: string;
};

export type TicketsWithoutGithubIssueLinkResult =
  | {
      readonly ok: true;
      readonly tickets: readonly TicketWithoutGithubIssueLink[];
    }
  | {
      readonly ok: false;
      readonly error: TicketGithubIssueLinkRepositoryError;
    };

function parseLinkRow(row: unknown): TicketGithubIssueLinkResult {
  const parsed = ticketGithubIssueLinkSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, link: parsed.data };
}

/**
 * BUILD_PLAN 4.4b's claim-first idempotency guard (Alex confirmed via `AskUserQuestion` over a
 * best-effort-log-only alternative) — inserts a `pending` row (no `issueNumber`/`issueUrl` yet)
 * BEFORE the caller ever calls GitHub's `issues.create`, so a process crash between a successful
 * GitHub call and the follow-up `resolveTicketGithubIssueLink` write can't silently trigger a
 * second, duplicate issue on retry: a later run finds this row already exists (via
 * `listTicketsWithoutGithubIssueLink`'s own `LEFT JOIN`) and skips the ticket outright.
 * `ticketId` is the table's own `PRIMARY KEY` — `onConflict().doNothing()` makes the claim atomic
 * without a separate SELECT-then-INSERT race, mirroring `github-issue-triage-repository.ts`'s own
 * `onConflict` shape but for exclusion, not update.
 */
export async function claimTicketForIssueCreation(
  db: Kysely<Database>,
  input: NewTicketGithubIssueLinkClaim,
): Promise<TicketGithubIssueLinkClaimResult> {
  const candidate = {
    ticketId: input.ticketId,
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    issueNumber: null,
    issueUrl: null,
    resolvedAt: null,
    createdAt: new Date(),
  };

  const validated = parseLinkRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('ticketGithubIssueLinks')
      .values(candidate)
      .onConflict((oc) => oc.column('ticketId').doNothing())
      .returningAll()
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'already-claimed' } };
    return parseLinkRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Atomically resolves a pending claim once GitHub's `issues.create` call actually succeeds — same
 * `UPDATE ... WHERE resolvedAt IS NULL` compare-and-set shape as
 * `pending-ticket-drafts-repository.ts`'s `resolvePendingTicketDraft`. Returns `'unavailable'`
 * (not a Blocking error) when there's no matching pending claim — already resolved, or the ticket
 * was never claimed at all — the caller decides what that means, this function only reports it.
 */
export async function resolveTicketGithubIssueLink(
  db: Kysely<Database>,
  ticketId: string,
  resolved: ResolvedTicketGithubIssue,
): Promise<TicketGithubIssueLinkResolveResult> {
  try {
    const row = await db
      .updateTable('ticketGithubIssueLinks')
      .set({
        issueNumber: resolved.issueNumber,
        issueUrl: resolved.issueUrl,
        resolvedAt: new Date(),
      })
      .where('ticketId', '=', ticketId)
      .where('resolvedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseLinkRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Deletes a still-pending (unresolved) claim so a future run can retry cleanly — called when
 * GitHub's `issues.create` call itself fails with a definitive error (no issue was ever created),
 * distinct from an ambiguous failure (a crash, a dropped connection) that leaves the claim in
 * place deliberately, surfaced instead by `listStuckPendingTicketGithubIssueLinks` for a human to
 * reconcile rather than silently retried. Scoped to `resolvedAt IS NULL` so it can never delete an
 * already-resolved (real) link even if called with a stale/incorrect `ticketId`.
 */
export async function releaseTicketGithubIssueClaim(
  db: Kysely<Database>,
  ticketId: string,
): Promise<ReleaseResult> {
  try {
    await db
      .deleteFrom('ticketGithubIssueLinks')
      .where('ticketId', '=', ticketId)
      .where('resolvedAt', 'is', null)
      .execute();
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: { cause } };
  }
}

/** Looks up a ticket's link row, pending or resolved. Returns `{ ok: true, link: null }` when none exists. */
export async function getTicketGithubIssueLink(
  db: Kysely<Database>,
  ticketId: string,
): Promise<TicketGithubIssueLinkOrNullResult> {
  try {
    const row = await db
      .selectFrom('ticketGithubIssueLinks')
      .selectAll()
      .where('ticketId', '=', ticketId)
      .executeTakeFirst();
    if (!row) return { ok: true, link: null };
    const parsed = parseLinkRow(row);
    return parsed.ok ? { ok: true, link: parsed.link } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * The outbound issue-creation script's own candidate list (BUILD_PLAN 4.4b) — every ticket with
 * no row at all in `ticket_github_issue_links`, `pending` or resolved. A ticket with a still-`
 * pending` claim (from this run or a prior crashed one) is deliberately excluded, not just an
 * already-resolved one — re-claiming it here would race `releaseTicketGithubIssueClaim`'s own
 * caller mid-run and risks a second `issues.create` call for a ticket a prior attempt might have
 * already created for real (`listStuckPendingTicketGithubIssueLinks` surfaces those instead).
 */
export async function listTicketsWithoutGithubIssueLink(
  db: Kysely<Database>,
): Promise<TicketsWithoutGithubIssueLinkResult> {
  try {
    const rows = await db
      .selectFrom('tickets')
      .leftJoin(
        'ticketGithubIssueLinks',
        'ticketGithubIssueLinks.ticketId',
        'tickets.id',
      )
      .select(['tickets.id as id', 'tickets.title as title'])
      .where('ticketGithubIssueLinks.ticketId', 'is', null)
      .execute();

    return { ok: true, tickets: rows };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Lists every resolved link (`resolvedAt IS NOT NULL`) — BUILD_PLAN 4.4c's reconciliation poll's
 * own candidate list, the inverse scope of `listStuckPendingTicketGithubIssueLinks` below: a link
 * only becomes reconcilable once GitHub's `issues.create` actually succeeded and
 * `resolveTicketGithubIssueLink` recorded a real `issueNumber`, since there's no GitHub issue yet
 * to check the state of while a claim is still `pending`.
 */
export async function listResolvedTicketGithubIssueLinks(
  db: Kysely<Database>,
): Promise<TicketGithubIssueLinkListResult> {
  try {
    const rows = await db
      .selectFrom('ticketGithubIssueLinks')
      .selectAll()
      .where('resolvedAt', 'is not', null)
      .execute();

    const parsedRows = rows.map((row) => parseLinkRow(row));
    const failure = parsedRows.find((parsed) => !parsed.ok);
    if (failure) return failure;

    return {
      ok: true,
      links: parsedRows
        .filter(
          (parsed): parsed is Extract<typeof parsed, { ok: true }> => parsed.ok,
        )
        .map((parsed) => parsed.link),
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Finds every claim left `pending` (`resolvedAt IS NULL`) — surfaced so a human can reconcile a
 * ticket a prior run's process crash left in an unknown state (did `issues.create` actually
 * succeed on GitHub before the crash, or not?) rather than either silently re-attempting it (risks
 * a duplicate real issue) or silently losing it forever. Call this BEFORE a run makes any new
 * claims of its own — within a single run, a claim's own pending window closes synchronously
 * (`resolveTicketGithubIssueLink` or `releaseTicketGithubIssueClaim` right after the GitHub call),
 * so anything still pending at a run's start is necessarily left over from an earlier one.
 */
export async function listStuckPendingTicketGithubIssueLinks(
  db: Kysely<Database>,
): Promise<TicketGithubIssueLinkListResult> {
  try {
    const rows = await db
      .selectFrom('ticketGithubIssueLinks')
      .selectAll()
      .where('resolvedAt', 'is', null)
      .execute();

    const parsedRows = rows.map((row) => parseLinkRow(row));
    const failure = parsedRows.find((parsed) => !parsed.ok);
    if (failure) return failure;

    return {
      ok: true,
      links: parsedRows
        .filter(
          (parsed): parsed is Extract<typeof parsed, { ok: true }> => parsed.ok,
        )
        .map((parsed) => parsed.link),
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
