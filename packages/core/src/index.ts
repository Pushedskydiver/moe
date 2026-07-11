export { boardStatusSchema } from './board-status.js';
export type { BoardStatus } from './board-status.js';

export { projectKeySchema } from './project-key.js';
export type { ProjectKey } from './project-key.js';

export { severitySchema } from './severity.js';
export type { Severity } from './severity.js';

export { ticketSchema } from './ticket.js';
export type { Ticket } from './ticket.js';

export { claimTicket, releaseTicket } from './ticket-lifecycle/claim.js';
export type {
  ClaimError,
  ClaimResult,
  TicketClaim,
} from './ticket-lifecycle/claim.js';
export { createDb, createPool } from './ticket-lifecycle/db.js';
export { runMigrations } from './ticket-lifecycle/migrate.js';
export type { MigrateResult } from './ticket-lifecycle/migrate.js';
export type { Database, TicketsTable } from './ticket-lifecycle/schema.js';
export {
  createTicket,
  getTicketById,
  listTickets,
  updateTicket,
} from './ticket-lifecycle/tickets-repository.js';
export type {
  NewTicket,
  TicketListResult,
  TicketOrNullResult,
  TicketPatch,
  TicketRepositoryError,
  TicketResult,
} from './ticket-lifecycle/tickets-repository.js';
