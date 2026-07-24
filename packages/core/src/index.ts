export { boardStatusSchema } from './board-status.js';
export type { BoardStatus } from './board-status.js';

export { classOfServiceSchema } from './class-of-service.js';
export type { ClassOfService } from './class-of-service.js';

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

export type { PendingTicketDraft } from './intake/pending-ticket-draft.js';
export { draftOriginSchema } from './intake/pending-ticket-draft.js';
export type { DraftOrigin } from './intake/pending-ticket-draft.js';
export {
  createPendingTicketDraft,
  getPendingTicketDraftByMessage,
  resolvePendingTicketDraft,
  updatePendingTicketDraftContent,
} from './intake/pending-ticket-drafts-repository.js';
export type {
  NewPendingTicketDraft,
  PendingTicketDraftClaimError,
  PendingTicketDraftClaimResult,
  PendingTicketDraftOrNullResult,
  PendingTicketDraftRepositoryError,
  PendingTicketDraftResult,
} from './intake/pending-ticket-drafts-repository.js';

export {
  draftOutcomeCountsSchema,
  getDraftOutcomeCounts,
} from './intake/draft-outcome-counts.js';
export type {
  DraftOutcomeCounts,
  DraftOutcomeCountsError,
  DraftOutcomeCountsResult,
} from './intake/draft-outcome-counts.js';

export { reviewQueueEntrySchema } from './intake/review-queue-entry.js';
export type { ReviewQueueEntry } from './intake/review-queue-entry.js';
export {
  createReviewQueueEntry,
  listReviewQueueEntriesSince,
} from './intake/review-queue-repository.js';
export type {
  NewReviewQueueEntry,
  ReviewQueueEntryListResult,
  ReviewQueueEntryResult,
  ReviewQueueRepositoryError,
} from './intake/review-queue-repository.js';

export { pendingConfirmingQuestionSchema } from './intake/pending-confirming-question.js';
export type { PendingConfirmingQuestion } from './intake/pending-confirming-question.js';
export {
  createPendingConfirmingQuestion,
  findStaleUnresolvedConfirmingQuestions,
  getPendingConfirmingQuestionByMessage,
  resolvePendingConfirmingQuestion,
} from './intake/pending-confirming-questions-repository.js';
export type {
  NewPendingConfirmingQuestion,
  PendingConfirmingQuestionClaimError,
  PendingConfirmingQuestionClaimResult,
  PendingConfirmingQuestionListResult,
  PendingConfirmingQuestionOrNullResult,
  PendingConfirmingQuestionRepositoryError,
  PendingConfirmingQuestionResult,
} from './intake/pending-confirming-questions-repository.js';

export { sweepStateSchema } from './intake/sweep-state.js';
export type { SweepState } from './intake/sweep-state.js';
export {
  getSweepState,
  recordSweepCompleted,
} from './intake/sweep-state-repository.js';
export type {
  SweepStateOrNullResult,
  SweepStateRepositoryError,
  SweepStateResult,
} from './intake/sweep-state-repository.js';

export { createTicketFromDraft } from './intake/commit-ticket-draft.js';
export type {
  CommitTicketDraftError,
  CommitTicketDraftResult,
} from './intake/commit-ticket-draft.js';

export { resolveConfirmingQuestionAndLog } from './intake/resolve-confirming-question-and-log.js';
export type {
  ResolveConfirmingQuestionAndLogError,
  ResolveConfirmingQuestionAndLogResult,
} from './intake/resolve-confirming-question-and-log.js';

export type { GithubIssueTriageEntry } from './intake/github-issue-triage-entry.js';
export { upsertGithubIssueTriageEntry } from './intake/github-issue-triage-repository.js';
export type {
  GithubIssueTriageEntryResult,
  GithubIssueTriageRepositoryError,
  NewGithubIssueTriageEntry,
} from './intake/github-issue-triage-repository.js';

export type { TicketGithubIssueLink } from './intake/ticket-github-issue-link.js';
export {
  claimTicketForIssueCreation,
  getTicketGithubIssueLink,
  listResolvedTicketGithubIssueLinks,
  listStuckPendingTicketGithubIssueLinks,
  listTicketsWithoutGithubIssueLink,
  releaseTicketGithubIssueClaim,
  resolveTicketGithubIssueLink,
} from './intake/ticket-github-issue-link-repository.js';
export type {
  NewTicketGithubIssueLinkClaim,
  ReleaseResult,
  ResolvedTicketGithubIssue,
  TicketGithubIssueLinkClaimError,
  TicketGithubIssueLinkClaimResult,
  TicketGithubIssueLinkListResult,
  TicketGithubIssueLinkOrNullResult,
  TicketGithubIssueLinkRepositoryError,
  TicketGithubIssueLinkResolveError,
  TicketGithubIssueLinkResolveResult,
  TicketGithubIssueLinkResult,
  TicketsWithoutGithubIssueLinkResult,
  TicketWithoutGithubIssueLink,
} from './intake/ticket-github-issue-link-repository.js';

export type { AppLogger } from './app-logger.js';

export { PERSONA_ROSTER, personaIdSchema } from './persona-roster.js';
export type { PersonaId } from './persona-roster.js';

export { evaluateWipLimit } from './capacity/wip-limit-guard.js';
export type {
  WipLimitDecision,
  WipLimitReason,
} from './capacity/wip-limit-guard.js';
export { DEFAULT_WIP_LIMITS } from './capacity/wip-limits-config.js';
export type { WipLimitsConfig } from './capacity/wip-limits-config.js';

export { generateBackupFileName } from './backup/backup-file-name.js';
export { buildDockerRunCommand } from './backup/docker-run-command.js';
export type {
  DockerRunCommand,
  DockerRunCommandInput,
} from './backup/docker-run-command.js';
export { buildPgDumpCommand } from './backup/pg-dump-command.js';
export { buildPgRestoreCommand } from './backup/pg-restore-command.js';
export { formatEnvFileContents } from './backup/format-env-file-contents.js';
export { isShellSafeFileName } from './backup/is-shell-safe-file-name.js';
export { parsePgEnvFromConnectionString } from './backup/pg-env-from-connection-string.js';
export type { PgConnectionEnv } from './backup/pg-env-from-connection-string.js';
export { redactConnectionStringForDisplay } from './backup/redact-connection-string-for-display.js';
