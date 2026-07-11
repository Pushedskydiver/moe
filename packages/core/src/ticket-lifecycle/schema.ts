import type { Generated } from 'kysely';

/**
 * Kysely's compile-time table shape. camelCase here matches the app-facing `Ticket` type — the
 * `CamelCasePlugin` (wired in `db.ts`) translates to/from the actual snake_case SQL columns, so
 * this file and the migrations' column names intentionally look different. `claimedBy`/`version`
 * are deliberately absent from the app-facing `Ticket` type (`../ticket.ts`) — they're the
 * atomic-claim primitive's own state (`./claim.ts`), not part of the pure domain shape.
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

export type Database = {
  readonly tickets: TicketsTable;
};
