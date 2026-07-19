import type { Generated } from 'kysely';

/**
 * Kysely's compile-time table shape. camelCase here matches the app-facing `Ticket` type — the
 * `CamelCasePlugin` (wired in `db.ts`) translates to/from the actual snake_case SQL columns, so
 * this file and the migrations' column names intentionally look different. `claimedBy`/`version`
 * are deliberately absent from the app-facing `Ticket` type (`./ticket.ts`) — they're the
 * atomic-claim primitive's own state (`./ticket-lifecycle/claim.ts`), not part of the pure domain
 * shape.
 *
 * `version` is `Generated<number>` because it has a real DB-level `DEFAULT 0` (Kysely's
 * `Insertable<T>` only treats `Generated` columns as optional on insert). `claimedBy` is nullable
 * but deliberately NOT `Generated`, even though an omitted nullable column also defaults to NULL
 * at the SQL level — this keeps "every new ticket explicitly declares itself unclaimed" a visible
 * choice at the insert call site (`tickets-repository.ts`'s `createTicket`) rather than an
 * implicit one.
 */
export type TicketsTable = {
  readonly id: string;
  readonly projectKey: string;
  readonly title: string;
  readonly status: string;
  readonly severity: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly claimedBy: string | null;
  readonly version: Generated<number>;
};

/** Kysely's compile-time shape for `conversation_turns` (`./conversation-history/conversation-turn.ts`'s DB-backed counterpart). */
export type ConversationTurnsTable = {
  readonly id: string;
  readonly personaId: string;
  readonly channelId: string;
  readonly threadKey: string;
  readonly role: string;
  readonly content: string;
  readonly createdAt: Date;
};

/**
 * Kysely's compile-time shape for `persona_cost_daily` (`./cost-usage/cost-usage.ts`'s DB-backed
 * counterpart, BUILD_PLAN 2.6a). `inputTokens`/`outputTokens`/`costUsdMicros` are `BIGINT` at the
 * SQL level — `pg`'s default type parser returns those as strings, not numbers, to avoid silent
 * precision loss past `Number.MAX_SAFE_INTEGER`; the repository layer parses them back to numbers
 * via `personaCostUsageSchema`'s `z.coerce.number().int()` fields — coercion, not a plain
 * `z.number()`, so the same schema also validates a freshly-computed candidate row's real numbers
 * regardless of which shape a given `pg` version hands back.
 * No `model` column — every persona uses exactly one hardcoded model today (`generate-reply.ts`'s
 * `MODEL` constant), so `costUsdMicros` blending across an implicit single model is safe. Adding a
 * `model` column (and widening the primary key to include it) is the real fix once "per-persona
 * model tuning as real data comes in" (`docs/VISION.md` §10) actually lands a second model.
 */
export type PersonaCostDailyTable = {
  readonly personaId: string;
  readonly day: string;
  readonly inputTokens: string | number;
  readonly outputTokens: string | number;
  readonly costUsdMicros: string | number;
  readonly updatedAt: Date;
};

/**
 * Kysely's compile-time shape for `persona_cost_alerts` (`./cost-cap/cost-cap.ts`'s DB-backed
 * counterpart, BUILD_PLAN 2.6b). `highestThresholdAlerted` is a SQL `INTEGER`, not `BIGINT` — its
 * whole valid range tops out at 100, so `pg`'s default `int4` parser already returns a real
 * number (unlike `PersonaCostDailyTable`'s `BIGINT` columns above).
 */
export type PersonaCostAlertsTable = {
  readonly personaId: string;
  readonly month: string;
  readonly highestThresholdAlerted: number;
  readonly updatedAt: Date;
};

/**
 * Kysely's compile-time shape for `pending_ticket_drafts` (`./intake/pending-ticket-draft.ts`'s
 * DB-backed counterpart, BUILD_PLAN 3.4a-ii). `resolvedAt` is genuinely nullable at both the SQL
 * and app-facing layers (not `Generated`) — an unresolved draft's null-ness is the CAS predicate
 * `resolvePendingTicketDraft` claims against, same shape as `TicketsTable.claimedBy` above.
 */
type PendingTicketDraftsTable = {
  readonly id: string;
  readonly personaId: string;
  readonly channelId: string;
  readonly messageTs: string;
  readonly sourceMessageText: string;
  readonly draftTitle: string;
  readonly draftBody: string;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
};

/**
 * Kysely's compile-time shape for `review_queue` (`./intake/review-queue-entry.ts`'s DB-backed
 * counterpart, BUILD_PLAN 3.4c). `outcomeReason` is `TEXT` with a SQL `CHECK` constraint, not a
 * Postgres `ENUM` — same reasoning as `TicketsTable.status`/`.severity` above it in this file.
 * Confidence-banded routing (`../confidence-band.ts`) only ever writes `'low-confidence'` here as
 * of this chunk; `'mid-no-response'` is BUILD_PLAN 3.4b's own future write, once its confirming
 * question resolves to "no" or silence — the column exists now so 3.4b needs no further migration.
 */
type ReviewQueueTable = {
  readonly id: string;
  readonly personaId: string;
  readonly channelId: string;
  readonly messageTs: string;
  readonly sourceMessageText: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly outcomeReason: string;
  readonly createdAt: Date;
};

export type Database = {
  readonly tickets: TicketsTable;
  readonly conversationTurns: ConversationTurnsTable;
  readonly personaCostDaily: PersonaCostDailyTable;
  readonly personaCostAlerts: PersonaCostAlertsTable;
  readonly pendingTicketDrafts: PendingTicketDraftsTable;
  readonly reviewQueue: ReviewQueueTable;
};
