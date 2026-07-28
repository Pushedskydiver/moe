import type { Database } from '../schema.js';
import type { PendingTicketDraft } from './pending-ticket-draft.js';
import type { Kysely } from 'kysely';

import { sql } from 'kysely';

import { pendingTicketDraftSchema } from './pending-ticket-draft.js';

// BUILD_PLAN 5.2b — `sourceMessageTs` is nullable on `PendingTicketDraft` itself (one pre-5.2b
// legacy row can't be backfilled with it), but every *new* claim always has a real one: it's the
// natural key the claim-first insert is keyed on, known before the Slack post ever happens. No
// `messageTs` here at all — genuinely unknown until `markPendingTicketDraftPosted` fills it in.
export type NewPendingTicketDraft = Pick<
  PendingTicketDraft,
  | 'personaId'
  | 'channelId'
  | 'sourceMessageText'
  | 'draftTitle'
  | 'draftBody'
  | 'origin'
> & {
  readonly sourceMessageTs: string;
};

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
 * Claims a ticket draft's "parent-message state" (BUILD_PLAN 3.4a-ii's own text names it) *before*
 * the Slack post that will produce it — BUILD_PLAN 5.2b's defence-in-depth for 5.2a's
 * single-listener fix, making a duplicate draft post structurally impossible rather than
 * configuration-dependent. Keyed on `input.sourceMessageTs`, the one natural key every process
 * computes identically ahead of any Slack call — `UNIQUE (channel_id, source_message_ts)`
 * (migration `0020`) is what actually arbitrates a race, unlike the old `(channel_id, messageTs)`
 * constraint, which never could (`messageTs` didn't exist until after the post). `messageTs` starts
 * `null` and is filled in by `markPendingTicketDraftPosted` once the post succeeds; a post that
 * fails leaves the claim row orphaned (`messageTs` stays `null` forever) rather than retried — the
 * same accepted trade-off `createGithubIssue`'s own claim-first idempotency guard already makes
 * (BUILD_PLAN 4.4b: "a still-`pending` row from a prior crashed run is surfaced for manual
 * reconciliation, never auto-retried"). Shared by all three writers — `composeAndPostDraft`'s
 * ambient High-band auto-draft path, `draftFromConfirmingQuestion`'s Mid-band 👍-confirmed path,
 * and `runDmIntakeCascade`'s DM High-band path (BUILD_PLAN 3.7), each going through
 * `postAndPersistDraft` — with `input.origin` (BUILD_PLAN 3.6/3.7) recording which one produced
 * this particular row. Validates the full candidate row through `pendingTicketDraftSchema` before
 * writing, so an invalid input never reaches the database.
 */
export async function createPendingTicketDraft(
  db: Kysely<Database>,
  input: NewPendingTicketDraft,
): Promise<PendingTicketDraftResult> {
  const candidate = {
    id: crypto.randomUUID(),
    ...input,
    messageTs: null,
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
 * Fills in `messageTs` on an already-claimed draft once its Slack post actually succeeds
 * (BUILD_PLAN 5.2b) — the second half of the claim-first insert `createPendingTicketDraft` starts.
 * `WHERE messageTs IS NULL` is a CAS guard, same shape as `resolvePendingTicketDraft`'s own
 * `WHERE resolvedAt IS NULL`: this should only ever run once per row, and a retry that lands after
 * an earlier call already succeeded (a timed-out response whose write actually landed, say) must
 * not silently overwrite a real `messageTs` with another one. Reuses
 * `PendingTicketDraftClaimResult`/`Error` — the "row must exist and be in a specific pre-condition
 * state" shape is identical to `resolvePendingTicketDraft`'s, just gated on a different column.
 */
export async function markPendingTicketDraftPosted(
  db: Kysely<Database>,
  id: string,
  messageTs: string,
): Promise<PendingTicketDraftClaimResult> {
  try {
    const row = await db
      .updateTable('pendingTicketDrafts')
      .set({ messageTs })
      .where('id', '=', id)
      .where('messageTs', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
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
  scope: {
    readonly personaId: string;
    readonly channelId: string;
    readonly messageTs: string;
  },
): Promise<PendingTicketDraftOrNullResult> {
  try {
    const row = await db
      .selectFrom('pendingTicketDrafts')
      // `personaId` first, and load-bearing (DA review, BUILD_PLAN 5.2a): a persona must only ever
      // resolve reactions on drafts **it** posted. `(channelId, messageTs)` alone identifies one
      // Slack message globally, so without this every persona in a shared channel dispatches every
      // other persona's reactions — including the 📦/🔁/✅ legend each draft seeds onto itself,
      // which a sibling process reads as a human action because its self-filter only knows its own
      // bot id. A draft would park itself to Backlog before anyone saw it.
      .where('personaId', '=', scope.personaId)
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
