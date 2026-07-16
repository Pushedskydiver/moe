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

export type Database = {
  readonly tickets: TicketsTable;
  readonly conversationTurns: ConversationTurnsTable;
};
