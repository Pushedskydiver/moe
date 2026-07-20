import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';

import { z } from 'zod';

// `pg`'s default type parser returns `BIGINT`/`COUNT(*)` results as strings, not numbers, to
// avoid silent precision loss past `Number.MAX_SAFE_INTEGER` — same reasoning
// `PersonaCostDailyTable`'s own TSDoc documents for its `BIGINT` columns. `z.coerce.number()`
// parses either shape back to a real number safely.
export const draftOutcomeCountsSchema = z.object({
  committed: z.coerce.number().int().nonnegative(),
  redone: z.coerce.number().int().nonnegative(),
  ignored: z.coerce.number().int().nonnegative(),
});

export type DraftOutcomeCounts = z.infer<typeof draftOutcomeCountsSchema>;

export type DraftOutcomeCountsError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type DraftOutcomeCountsResult =
  | { readonly ok: true; readonly counts: DraftOutcomeCounts }
  | { readonly ok: false; readonly error: DraftOutcomeCountsError };

/**
 * BUILD_PLAN 3.6 — counts a persona's High-band `pending_ticket_drafts` by outcome, lifetime
 * cumulative (not windowed to a sweep's own "since" boundary — VISION §5.4 names the ignored/
 * rejected-draft rate as the metric to watch, which favors the full accumulated trend over a noisy
 * per-window slice, recomputed fresh each call). Scoped to `origin: 'high-band'` only (DA review,
 * chunk 3.6: this originally counted Mid-band-confirmed drafts too, since `pending_ticket_drafts`
 * has both origins in one table — skewing the reported acceptance rate upward, since a Mid-band
 * draft has already passed a human-confirmation gate before drafting even happens. VISION §5.2's
 * own text ties "ignored/corrected draft" specifically to the High-confidence bullet, not
 * Mid-confidence's separate confirming-question action, confirmed by re-reading the primary source
 * directly rather than trusting the finding's own framing — see `../pending-ticket-draft.ts`'s
 * `draftOriginSchema` for the full reasoning). Three further genuinely open bucket-definition
 * questions were resolved with Alex via `AskUserQuestion` before this was built, not guessed:
 * `'committed'` folds in both ✅ and 📦 outcomes (both mean "accepted as real work, a ticket now
 * exists," just different triage status — a draft's own row carries no record of *which* reaction
 * resolved it, only that one did); `'redone'` means still-open AND regenerated at least once,
 * distinguishing a draft the human has engaged with from one nobody's touched, no age qualifier of
 * its own since a redo is itself an explicit human action with no ambiguity about "did they have a
 * chance to react"; `'ignored'` requires `redoCount = 0` AND older than `scope.ignoredOlderThan`,
 * reusing chunk 3.5's own 24-hour-silence reasoning so a draft posted moments before this query
 * runs isn't miscounted as ignored before anyone's had a fair chance to react to it. A still-open,
 * never-redone draft younger than the threshold falls into none of the three buckets — correctly
 * excluded, not "too fresh to categorize" being silently folded into `'ignored'`. One aggregate
 * query with three `FILTER (WHERE ...)` clauses, not three round-trips.
 */
export async function getDraftOutcomeCounts(
  db: Kysely<Database>,
  scope: { readonly personaId: string; readonly ignoredOlderThan: Date },
): Promise<DraftOutcomeCountsResult> {
  try {
    const row = await db
      .selectFrom('pendingTicketDrafts')
      .select((eb) => [
        eb.fn
          .countAll<number>()
          .filterWhere('resolvedAt', 'is not', null)
          .as('committed'),
        eb.fn
          .countAll<number>()
          .filterWhere((eb2) =>
            eb2.and([eb2('resolvedAt', 'is', null), eb2('redoCount', '>', 0)]),
          )
          .as('redone'),
        eb.fn
          .countAll<number>()
          .filterWhere((eb2) =>
            eb2.and([
              eb2('resolvedAt', 'is', null),
              eb2('redoCount', '=', 0),
              eb2('createdAt', '<', scope.ignoredOlderThan),
            ]),
          )
          .as('ignored'),
      ])
      .where('personaId', '=', scope.personaId)
      .where('origin', '=', 'high-band')
      .executeTakeFirstOrThrow();

    const parsed = draftOutcomeCountsSchema.safeParse(row);
    if (!parsed.success) {
      return {
        ok: false,
        error: { kind: 'validation-failed', issues: parsed.error.message },
      };
    }
    return { ok: true, counts: parsed.data };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
