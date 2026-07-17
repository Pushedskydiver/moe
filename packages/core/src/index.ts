export { boardStatusSchema } from './board-status.js';
export type { BoardStatus } from './board-status.js';

export { projectKeySchema } from './project-key.js';
export type { ProjectKey } from './project-key.js';

export { classifyRiskTier } from './risk-tier.js';
export type { DiffMeta, RiskTier, TouchedDirectory } from './risk-tier.js';

export { severitySchema } from './severity.js';
export type { Severity } from './severity.js';

export { composeStatus, statusClaimSchema } from './status-claim.js';
export type {
  ComposedStatus,
  StatusClaim,
  StatusClaimCandidate,
} from './status-claim.js';

export { ticketSchema } from './ticket.js';
export type { Ticket } from './ticket.js';

export { claimTicket, releaseTicket } from './ticket-lifecycle/claim.js';
export type {
  ClaimError,
  ClaimResult,
  TicketClaim,
} from './ticket-lifecycle/claim.js';
export {
  appendTurn,
  getRecentTurns,
} from './conversation-history/conversation-turns-repository.js';
export type {
  ConversationTurnListResult,
  ConversationTurnRepositoryError,
  ConversationTurnResult,
  NewConversationTurn,
} from './conversation-history/conversation-turns-repository.js';
export { conversationTurnSchema } from './conversation-history/conversation-turn.js';
export type { ConversationTurn } from './conversation-history/conversation-turn.js';

export { parseDatabaseConfig } from './database-config.js';
export type { DatabaseConfig } from './database-config.js';

export { createDb, createPool } from './ticket-lifecycle/db.js';
export { runMigrations } from './ticket-lifecycle/migrate.js';
export type { MigrateResult } from './ticket-lifecycle/migrate.js';
export type {
  ConversationTurnsTable,
  Database,
  TicketsTable,
} from './schema.js';
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
