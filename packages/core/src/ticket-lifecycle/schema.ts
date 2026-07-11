/**
 * Kysely's compile-time table shape. camelCase here matches the app-facing `Ticket` type — the
 * `CamelCasePlugin` (wired in `db.ts`) translates to/from the actual snake_case SQL columns, so
 * this file and the migrations' column names intentionally look different.
 */
export type TicketsTable = {
  readonly id: string;
  readonly projectKey: string;
  readonly title: string;
  readonly status: string;
  readonly severity: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Database = {
  readonly tickets: TicketsTable;
};
