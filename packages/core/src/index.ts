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
  PersonaCostAlertsTable,
  PersonaCostDailyTable,
  TicketsTable,
} from './schema.js';
export {
  getPersonaCostForDay,
  recordUsage,
} from './cost-usage/cost-usage-repository.js';
export type {
  NewPersonaCostUsage,
  PersonaCostUsageOrNullResult,
  PersonaCostUsageRepositoryError,
  PersonaCostUsageResult,
} from './cost-usage/cost-usage-repository.js';
export {
  nonNegativeIntSchema,
  personaCostUsageSchema,
  toUtcDay,
  toUtcMonth,
} from './cost-usage/cost-usage.js';
export type { PersonaCostUsage } from './cost-usage/cost-usage.js';

export {
  claimAlertThreshold,
  getAlertState,
  getPersonaCostForMonth,
} from './cost-cap/cost-cap-repository.js';
export type {
  AlertClaimError,
  AlertClaimResult,
  CostCapRepositoryError,
  PersonaCostAlertOrNullResult,
  PersonaCostAlertResult,
  PersonaCostMonthlyTotalResult,
} from './cost-cap/cost-cap-repository.js';
export {
  COST_CAP_THRESHOLDS,
  personaCostAlertSchema,
  personaCostMonthlyTotalSchema,
} from './cost-cap/cost-cap.js';
export type {
  PersonaCostAlert,
  PersonaCostMonthlyTotal,
} from './cost-cap/cost-cap.js';
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

export { createBankHolidaysCache } from './core-hours/bank-holidays-cache.js';
export type { FetchBankHolidaysError } from './core-hours/bank-holidays-client.js';
export { DEFAULT_CORE_HOURS_CONFIG } from './core-hours/core-hours-config.js';
export type { CoreHoursConfig } from './core-hours/core-hours-config.js';
export { evaluateOperatingRhythm } from './core-hours/core-hours-guard.js';
export type {
  OperatingRhythmDecision,
  OperatingRhythmReason,
} from './core-hours/core-hours-guard.js';
export { isWithinCoreHoursWindow } from './core-hours/core-hours.js';

export type {
  ChannelScopeConfig,
  MessageSurface,
} from './channel-scoping/channel-scope-config.js';
export { isSurfaceInScope } from './channel-scoping/is-surface-in-scope.js';

export type { ConfidenceBand } from './confidence-band.js';
export { classifyConfidenceBand } from './confidence-band.js';
