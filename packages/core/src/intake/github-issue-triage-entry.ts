import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * BUILD_PLAN 4.2's own triage-queue row — one row per GitHub issue ever polled from
 * `@moe/github`'s configured `repo`, upserted (not appended) on every re-poll so a changed
 * title/state/`githubUpdatedAt` is reflected instead of accumulating a stale duplicate.
 * Deliberately minimal (a pointer, not the full issue body) — Alex confirmed this shape via
 * `AskUserQuestion` over storing the complete body up front, since a persona acting on a triage
 * entry later (BUILD_PLAN 6.1b) fetches the current body fresh from GitHub rather than risking a
 * stale cached copy. `(repoOwner, repoName, issueNumber)` is a natural composite primary key, not
 * a surrogate `id` — same no-surrogate-`id`, no-history reasoning as `sweep-state.ts`'s own
 * `personaId`-keyed table, since a given issue has exactly one current tracked state, never a
 * row-per-poll history. `githubUpdatedAt` is the issue's own `updated_at` from GitHub's API (the
 * real signal for "did this actually change"), distinct from `firstSeenAt`/`lastSeenAt` (moe's own
 * bookkeeping: when this row was first inserted, and when the most recent poll last touched it,
 * regardless of whether GitHub's own data changed).
 */
export const githubIssueTriageEntrySchema = z.object({
  repoOwner: nonBlankStringSchema,
  repoName: nonBlankStringSchema,
  issueNumber: z.number().int().positive(),
  title: nonBlankStringSchema,
  url: nonBlankStringSchema,
  state: z.enum(['open', 'closed']),
  githubUpdatedAt: z.date(),
  firstSeenAt: z.date(),
  lastSeenAt: z.date(),
});

export type GithubIssueTriageEntry = z.infer<
  typeof githubIssueTriageEntrySchema
>;
