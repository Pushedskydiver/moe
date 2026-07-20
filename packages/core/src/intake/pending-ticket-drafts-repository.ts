import type { Database } from '../schema.js';
import type { PendingTicketDraft } from './pending-ticket-draft.js';
import type { Kysely } from 'kysely';

import { sql } from 'kysely';

import { pendingTicketDraftSchema } from './pending-ticket-draft.js';

export type NewPendingTicketDraft = Pick<
  PendingTicketDraft,
  | 'personaId'
  | 'channelId'
  | 'messageTs'
  | 'sourceMessageText'
  | 'draftTitle'
  | 'draftBody'
  | 'origin'
>;

export type PendingTicketDraftRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type PendingTicketDraftResult =
  | { readonly ok: true; readonly draft: PendingTicketDraft }
  | { readonly ok: false; readonly error: PendingTicketDraftRepositoryError };

export type PendingTicketDraftOrNullResult =
  | { readonly ok: true; readonly draft: PendingTicketDraft | null }
  | { readonly ok: false; readonly error: PendingTicketDraftRepositoryError };

// `'unavailable'` is specific to `resolvePendingTicketDraft`'s atomic-claim semantics below (the
// conditional update legitimately matching zero rows — already resolved, or no such draft — not a
// failure) — scoped to its own result type rather than widening `PendingTicketDraftRepositoryError`,
// same reasoning as `../ticket-lifecycle/claim.ts`'s own separate `ClaimError`.
export type PendingTicketDraftClaimError =
  PendingTicketDraftRepositoryError | { readonly kind: 'unavailable' };

export type PendingTicketDraftClaimResult =
  | { readonly ok: true; readonly draft: PendingTicketDraft }
  | { readonly ok: false; readonly error: PendingTicketDraftClaimError };

function parseDraftRow(row: unknown): PendingTicketDraftResult {
  const parsed = pendingTicketDraftSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, draft: parsed.data };
}

/**
 * Persists a ticket draft's "parent-message state" (BUILD_PLAN 3.4a-ii's own text names it) so a
 * later Slack reaction on the posted message can be traced back to it — a real consumer as of
 * BUILD_PLAN 3.4a-iii (`apps/server`'s `postAndPersistDraft`, called once the real post to Slack
 * succeeds, keyed on the posted message's own `ts`). Shared by both `composeAndPostDraft`'s own
 * High-band auto-draft path and `draftFromConfirmingQuestion`'s own Mid-band 👍-confirmed path
 * (`postAndPersistDraft`'s single caller either way) — `input.origin` (BUILD_PLAN 3.6) records
 * which one produced this particular row. Validates the full candidate row through
 * `pendingTicketDraftSchema` before writing, so an invalid input never reaches the database.
 */
export async function createPendingTicketDraft(
  db: Kysely<Database>,
  input: NewPendingTicketDraft,
): Promise<PendingTicketDraftResult> {
  const candidate = {
    id: crypto.randomUUID(),
    ...input,
    resolvedAt: null,
    createdAt: new Date(),
  };

  const validated = parseDraftRow(candidate);
  if (!validated.ok) return validated;

  try {
    const insert = db.insertInto('pendingTicketDrafts').values(candidate);
    const row = await insert.returningAll().executeTakeFirstOrThrow();
    return parseDraftRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Looks up the pending draft a real Slack message's `(channelId, messageTs)` corresponds to — the
 * lookup a real reaction-event handler needs before it can dispatch a ✅/🔁/📦 outcome. Returns a
 * null draft, not an error, when no draft was ever composed for that message.
 */
export async function getPendingTicketDraftByMessage(
  db: Kysely<Database>,
  scope: { readonly channelId: string; readonly messageTs: string },
): Promise<PendingTicketDraftOrNullResult> {
  try {
    const row = await db
      .selectFrom('pendingTicketDrafts')
      .selectAll()
      .where('channelId', '=', scope.channelId)
      .where('messageTs', '=', scope.messageTs)
      .executeTakeFirst();

    if (!row) return { ok: true, draft: null };
    return parseDraftRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Atomically claims a pending draft for a terminal outcome (✅ commit, 📦 park) — same
 * `UPDATE ... WHERE resolvedAt IS NULL` compare-and-set shape as `../ticket-lifecycle/claim.ts`'s
 * `claimTicket`, for the identical reason: two reactions landing on the same message (a genuine
 * double-fire, or a duplicate Slack event delivery) must resolve the draft at most once. 🔁's
 * regenerate path does NOT call this — it updates `draftTitle`/`draftBody` in place and leaves the
 * draft open for a further reaction, since regeneration isn't a terminal outcome.
 */
export async function resolvePendingTicketDraft(
  db: Kysely<Database>,
  id: string,
): Promise<PendingTicketDraftClaimResult> {
  try {
    const row = await db
      .updateTable('pendingTicketDrafts')
      .set({ resolvedAt: new Date() })
      .where('id', '=', id)
      .where('resolvedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseDraftRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Overwrites a draft's title/body in place for the 🔁 redo outcome — deliberately not gated on
 * `resolvedAt`, unlike `resolvePendingTicketDraft`'s CAS above: regeneration isn't a terminal claim,
 * so there's no double-processing race to guard against here. Whether redo should even be offered
 * on an already-resolved draft is a business rule for the reaction-event handler that calls this,
 * not this repository function's own concern. Also increments `redoCount` (BUILD_PLAN 3.6) — the
 * signal `./draft-outcome-counts.ts`'s `getDraftOutcomeCounts` uses to distinguish a still-open
 * draft the human has engaged with from one nobody's touched at all.
 */
export async function updatePendingTicketDraftContent(
  db: Kysely<Database>,
  id: string,
  content: { readonly draftTitle: string; readonly draftBody: string },
): Promise<PendingTicketDraftResult> {
  try {
    const row = await db
      .updateTable('pendingTicketDrafts')
      .set({ ...content, redoCount: sql`redo_count + 1` })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!row)
      return { ok: false, error: { kind: 'unknown', cause: 'not-found' } };
    return parseDraftRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
