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
