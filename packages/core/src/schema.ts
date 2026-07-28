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
 *
 * `classOfService` (BUILD_PLAN 4.5, migration `0016_add_ticket_class_of_service.sql`) is `TEXT`
 * with a `CHECK` constraint, same shape as `status`/`severity` above — not `Generated`, despite
 * having a real DB-level `DEFAULT 'Standard'`: that default exists solely to backfill pre-existing
 * rows on the `ALTER TABLE`, the same one-time historical-data caveat migration
 * `0013_add_pending_ticket_drafts_origin.sql`'s own SQL comment documents for `origin` below
 * (`PendingTicketDraftsTable`'s own TSDoc doesn't restate it). Every new insert supplies
 * `classOfService` explicitly (`tickets-repository.ts`'s `createTicket`, `NewTicket`'s Pick) —
 * `origin` is the direct precedent for this "DB default for backfill, always-explicit for new
 * rows" shape.
 */
export type TicketsTable = {
  readonly id: string;
  readonly projectKey: string;
  readonly title: string;
  readonly status: string;
  readonly severity: string;
  readonly classOfService: string;
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
 * `redoCount` (BUILD_PLAN 3.6, migration `0012_add_pending_ticket_drafts_redo_count.sql`) is
 * `Generated<number>` for the same reason `TicketsTable.version` is — a real DB-level `DEFAULT 0`.
 * Deliberately excluded from `pendingTicketDraftSchema` (the pure domain `PendingTicketDraft`
 * shape), same reasoning `ticketSchema`'s own TSDoc gives for omitting `version`/`claimedBy`: a
 * tracking/derivation field, not part of the domain shape a caller round-trips through the app —
 * only `./intake/draft-outcome-counts.ts`'s own aggregate queries read it directly off this table.
 * `origin` (BUILD_PLAN 3.6, migration `0013_add_pending_ticket_drafts_origin.sql`, widened to a
 * third value by `0017_widen_pending_ticket_drafts_origin.sql` at BUILD_PLAN 3.7) is `TEXT` with
 * a `CHECK` constraint, not `Generated` — every insert supplies it explicitly (DA review, chunk
 * 3.6: `getDraftOutcomeCounts` was originally counting both High-band and Mid-band-confirmed
 * drafts together despite every doc claiming "High-band," skewing the reported acceptance rate;
 * 3.7's DM drafts are kept out of that same population for the parallel reason). Unlike
 * `redoCount`, `origin` IS part of `pendingTicketDraftSchema` — it's domain-meaningful (which
 * Stage 2 band, on which surface, produced this draft), not a derived tracking artifact.
 */
type PendingTicketDraftsTable = {
  readonly id: string;
  readonly personaId: string;
  readonly channelId: string;
  // BUILD_PLAN 5.2b — nullable: unknown until `markPendingTicketDraftPosted` fills it in once the
  // Slack post succeeds. See `pending-ticket-draft.ts`'s own TSDoc for the full reasoning.
  readonly messageTs: string | null;
  // BUILD_PLAN 5.2b — the real claim key (`UNIQUE (channel_id, source_message_ts)`, migration
  // `0020`), not `messageTs`. Nullable only for one pre-5.2b legacy row this column can't be
  // backfilled for; every row this table writes going forward always has it.
  readonly sourceMessageTs: string | null;
  readonly sourceMessageText: string;
  readonly draftTitle: string;
  readonly draftBody: string;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
  readonly origin: string;
  readonly redoCount: Generated<number>;
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
 * added `'mid-yes-failed'` additively on top, and
 * `0019_widen_review_queue_outcome_reason_off_hours.sql` (BUILD_PLAN 3.9) added
 * `'high-band-off-hours'`/`'mid-band-off-hours'` the same way — an **ambient** High- or Mid-band
 * message the 2.7a operating-rhythm guard blocked, which until then was dropped with nothing
 * persisted at all (`logAmbientIntakeToReviewQueue`).
 *
 * Note `outcomeReason` is typed `string` here, not the union: Kysely's shape is the raw column, so
 * nothing in this file constrains the value. The enum lives in `./intake/review-queue-entry.ts` and
 * is enforced by `createReviewQueueEntry`'s pre-insert parse plus the SQL `CHECK` — which is why a
 * new value must land in the migration and the Zod enum together: adding one to the Zod enum
 * without the migration compiles cleanly and then fails at INSERT on the `CHECK`, and adding it to
 * the migration alone leaves nothing able to write it.
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
 * the confirming question's own posted message for a later reaction lookup (no longer the claim
 * key as of BUILD_PLAN 5.2b — see its own comment below, and `PendingTicketDraftsTable`'s identical
 * correction); `sourceMessageTs`/`sourceMessageText` are this table's own addition — needed so a
 * "yes" answer (3.4b-ii) can post the real ticket draft
 * against the *original* source message rather than the confirming question itself (threaded on it
 * for an ambient question, top-level for a DM — see `sourceSurface` below), and so a "no"
 * answer can carry the classifier's own `confidence`/`reasoning` through to `review_queue` the same
 * way the Low-band path already does.
 */
type PendingConfirmingQuestionsTable = {
  readonly id: string;
  readonly personaId: string;
  readonly channelId: string;
  // BUILD_PLAN 5.2b — nullable for the same reason as `PendingTicketDraftsTable.messageTs`:
  // unknown until `markPendingConfirmingQuestionPosted` fills it in once the Slack post succeeds.
  // The claim key moved to `sourceMessageTs` below (`UNIQUE (channel_id, source_message_ts)`,
  // migration `0021`), which — unlike the drafts table — this table has always required non-null.
  readonly messageTs: string | null;
  // BUILD_PLAN 3.7 — `'channel'` or `'dm'`, with a `CHECK` constraint
  // (`0018_add_pending_confirming_questions_source_surface.sql`). Decides whether the 👍 outcome's
  // draft is posted threaded or top-level; see `pending-confirming-question.ts`'s own TSDoc.
  readonly sourceSurface: string;
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

/**
 * Kysely's compile-time shape for `github_issue_triage`
 * (`./intake/github-issue-triage-entry.ts`'s DB-backed counterpart, BUILD_PLAN 4.2) —
 * `(repoOwner, repoName, issueNumber)` is a composite `PRIMARY KEY`, same no-surrogate-`id`,
 * no-history reasoning as `SweepStateTable` above: a given issue has exactly one current tracked
 * state, upserted on every re-poll rather than accumulating a row per poll.
 */
type GithubIssueTriageTable = {
  readonly repoOwner: string;
  readonly repoName: string;
  readonly issueNumber: number;
  readonly title: string;
  readonly url: string;
  readonly state: string;
  readonly githubUpdatedAt: Date;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
};

/**
 * Kysely's compile-time shape for `ticket_github_issue_links`
 * (`./intake/ticket-github-issue-link.ts`'s DB-backed counterpart, BUILD_PLAN 4.4b) — `ticketId`
 * is the `PRIMARY KEY` (a ticket maps to at most one GitHub issue), a `REFERENCES tickets (id)`
 * foreign key. `issueNumber`/`issueUrl`/`resolvedAt` stay nullable until the real GitHub
 * `issues.create` call resolves them — a genuine two-phase claim-then-resolve, not
 * `GithubIssueTriageTable`'s stateless upsert-mirror shape, since a real external API call sits
 * between the row's insert and its resolution. A partial unique index on
 * `(repoOwner, repoName, issueNumber)` (migration `0015`, `WHERE issueNumber IS NOT NULL`) stops
 * two tickets from ever resolving to the same GitHub issue, without rejecting the many
 * still-`NULL` pending rows a partial index deliberately excludes.
 */
type TicketGithubIssueLinksTable = {
  readonly ticketId: string;
  readonly repoOwner: string;
  readonly repoName: string;
  readonly issueNumber: number | null;
  readonly issueUrl: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
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
  readonly githubIssueTriage: GithubIssueTriageTable;
  readonly ticketGithubIssueLinks: TicketGithubIssueLinksTable;
};
