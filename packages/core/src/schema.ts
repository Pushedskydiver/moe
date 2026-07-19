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
 * Postgres `ENUM` — same shape as `TicketsTable.status`/`.severity` above it in this file, though
 * that table's own comment doesn't spell out why: a `CHECK` constraint stays queryable/alterable
 * with plain SQL, where a Postgres `ENUM` needs `ALTER TYPE` to add a value later.
 * Confidence-banded routing (`./confidence-band.ts`) writes `'low-confidence'` here (chunk 3.4c);
 * BUILD_PLAN 3.4b-ii's own `logConfirmingQuestionAsNo` writes `'mid-no'` when a Mid-band confirming
 * question's 👎 reaction resolves it; `'mid-silence'` is BUILD_PLAN 3.5's own write
 * (`logStaleQuestionsAsSilent`), once an unanswered confirming question passes a 24-hour threshold;
 * `'mid-yes-failed'` is the claim-then-act fallback fix's own write (`draftFromConfirmingQuestion`),
 * once a 👍 answer's downstream draft composition/posting/persistence fails after the claim already
 * won. Migration
 * `0009_widen_review_queue_outcome_reason.sql` (3.4b-ii) replaced chunk 3.4c's original single
 * placeholder value, `'mid-no-response'`, with `'mid-no'`/`'mid-silence'` — "no" and
 * "silence"/timeout stay separately identifiable for 3.5's own human-eyeballing sweep, per that
 * chunk's own DA-review-flagged question. `0011_widen_review_queue_outcome_reason_again.sql`
 * added `'mid-yes-failed'` additively on top.
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

/**
 * Kysely's compile-time shape for `pending_confirming_questions`
 * (`./intake/pending-confirming-question.ts`'s DB-backed counterpart, BUILD_PLAN 3.4b-i) — the
 * Mid-band "parent-message state" `resolvePendingConfirmingQuestion` claims against, same CAS
 * shape as `PendingTicketDraftsTable.resolvedAt` above (a workflow object with resolve-once
 * semantics, unlike `ReviewQueueTable`'s deliberately different plain-log shape). `messageTs` keys
 * the confirming question's own posted message (for a later reaction lookup, mirroring
 * `PendingTicketDraftsTable`'s own `messageTs` exactly); `sourceMessageTs`/`sourceMessageText` are
 * this table's own addition — needed so a "yes" answer (3.4b-ii) can thread the real ticket draft
 * as a reply on the *original* ambient message, not the confirming question itself, and so a "no"
 * answer can carry the classifier's own `confidence`/`reasoning` through to `review_queue` the same
 * way the Low-band path already does.
 */
type PendingConfirmingQuestionsTable = {
  readonly id: string;
  readonly personaId: string;
  readonly channelId: string;
  readonly messageTs: string;
  readonly sourceMessageTs: string;
  readonly sourceMessageText: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
};

/**
 * Kysely's compile-time shape for `sweep_state` (`./intake/sweep-state.ts`'s DB-backed
 * counterpart, BUILD_PLAN 3.5) — one row per persona, tracking when that persona's own
 * `review-queue-sweep` CLI script last ran (`personaId` is the `PRIMARY KEY`, not a
 * surrogate `id`, since there's genuinely only ever one row per persona — no history, no
 * `createdAt`). Each sweep only reports `review_queue` rows created after `lastSweptAt`,
 * so an irregularly-run sweep never misses a row and never double-reports one — Alex
 * confirmed this design via `AskUserQuestion` over the cheaper "fixed rolling window from
 * now" alternative, which has real gaps if the script is skipped or run twice in one window.
 */
type SweepStateTable = {
  readonly personaId: string;
  readonly lastSweptAt: Date;
};

export type Database = {
  readonly tickets: TicketsTable;
  readonly conversationTurns: ConversationTurnsTable;
  readonly personaCostDaily: PersonaCostDailyTable;
  readonly personaCostAlerts: PersonaCostAlertsTable;
  readonly pendingTicketDrafts: PendingTicketDraftsTable;
  readonly reviewQueue: ReviewQueueTable;
  readonly pendingConfirmingQuestions: PendingConfirmingQuestionsTable;
  readonly sweepState: SweepStateTable;
};
