import type { Database } from '../schema.js';
import type { GithubIssueTriageEntry } from './github-issue-triage-entry.js';
import type { Kysely } from 'kysely';

import { githubIssueTriageEntrySchema } from './github-issue-triage-entry.js';

export type NewGithubIssueTriageEntry = Pick<
  GithubIssueTriageEntry,
  | 'repoOwner'
  | 'repoName'
  | 'issueNumber'
  | 'title'
  | 'url'
  | 'state'
  | 'githubUpdatedAt'
> & { readonly polledAt: Date };

export type GithubIssueTriageRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type GithubIssueTriageEntryResult =
  | { readonly ok: true; readonly entry: GithubIssueTriageEntry }
  | { readonly ok: false; readonly error: GithubIssueTriageRepositoryError };

export type GithubIssueTriageEntryOrNullResult =
  | { readonly ok: true; readonly entry: GithubIssueTriageEntry | null }
  | { readonly ok: false; readonly error: GithubIssueTriageRepositoryError };

function parseTriageRow(row: unknown): GithubIssueTriageEntryResult {
  const parsed = githubIssueTriageEntrySchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, entry: parsed.data };
}

/**
 * Upserts a polled GitHub issue into the triage queue (BUILD_PLAN 4.2) — an insert on first sight,
 * an update in place on every re-poll, keyed on the natural `(repoOwner, repoName, issueNumber)`
 * composite primary key. `firstSeenAt` is deliberately excluded from the conflict's `doUpdateSet`
 * (mirrors `sweep-state-repository.ts`'s own `onConflict` shape) — it's set once, on insert, and
 * never touched again, so a re-poll's `polledAt` only ever advances `lastSeenAt`, preserving the
 * row's original discovery time. Validates the full candidate row through
 * `githubIssueTriageEntrySchema` before writing, same "invalid input never reaches the database"
 * precedent as `createReviewQueueEntry`.
 */
export async function upsertGithubIssueTriageEntry(
  db: Kysely<Database>,
  input: NewGithubIssueTriageEntry,
): Promise<GithubIssueTriageEntryResult> {
  const { polledAt, ...rest } = input;
  const candidate = {
    ...rest,
    firstSeenAt: polledAt,
    lastSeenAt: polledAt,
  };

  const validated = parseTriageRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('githubIssueTriage')
      .values(candidate)
      .onConflict((oc) =>
        oc
          .columns(['repoOwner', 'repoName', 'issueNumber'])
          .doUpdateSet((eb) => ({
            title: eb.ref('excluded.title'),
            url: eb.ref('excluded.url'),
            state: eb.ref('excluded.state'),
            githubUpdatedAt: eb.ref('excluded.githubUpdatedAt'),
            lastSeenAt: eb.ref('excluded.lastSeenAt'),
          })),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return parseTriageRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * BUILD_PLAN 6.1b's own triage-to-ticket conversion candidate query — "not yet converted" is
 * answered by a `LEFT JOIN ... WHERE ticketGithubIssueLinks.ticketId IS NULL` anti-join on the
 * natural `(repoOwner, repoName, issueNumber)` key both tables already share, mirroring
 * `ticket-github-issue-link-repository.ts`'s own `listTicketsWithoutGithubIssueLink` anti-join
 * shape — except that precedent joins on a single column (`ticketId`), so this one needs Kysely's
 * 3-column callback join form (`.leftJoin(table, (join) => join.onRef(...).onRef(...).onRef(...))`)
 * instead of the simple two-argument form. Only `state = 'open'` entries are eligible — a closed
 * issue converting into a fresh Brief-stage ticket would be pointless. No row locking — moe runs
 * exactly one pull loop per persona (`CLAUDE.md`'s "every persona is its own long-running
 * process" constraint), so no other process ever races this read; a narrower version of the same
 * argument `transition.ts` makes for its own unlocked reads (today's one-ticket-per-tick pull-loop
 * cadence leaves no concurrent caller to race). `ORDER BY firstSeenAt ASC LIMIT 1` picks the oldest-discovered eligible
 * entry, so the triage queue drains in first-seen order across ticks, one conversion per tick
 * (`create-ticket-from-triage-entry.ts`'s own caller enforces the "one per tick" bound, not this
 * query). `{ ok: true, entry: null }` when nothing's eligible.
 */
export async function findNextUnconvertedGithubIssueTriageEntry(
  db: Kysely<Database>,
): Promise<GithubIssueTriageEntryOrNullResult> {
  try {
    const row = await db
      .selectFrom('githubIssueTriage')
      .leftJoin('ticketGithubIssueLinks', (join) =>
        join
          .onRef(
            'ticketGithubIssueLinks.repoOwner',
            '=',
            'githubIssueTriage.repoOwner',
          )
          .onRef(
            'ticketGithubIssueLinks.repoName',
            '=',
            'githubIssueTriage.repoName',
          )
          .onRef(
            'ticketGithubIssueLinks.issueNumber',
            '=',
            'githubIssueTriage.issueNumber',
          ),
      )
      .selectAll('githubIssueTriage')
      .where('ticketGithubIssueLinks.ticketId', 'is', null)
      .where('githubIssueTriage.state', '=', 'open')
      .orderBy('githubIssueTriage.firstSeenAt', 'asc')
      .limit(1)
      .executeTakeFirst();

    if (!row) return { ok: true, entry: null };
    const parsed = parseTriageRow(row);
    return parsed.ok ? { ok: true, entry: parsed.entry } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
