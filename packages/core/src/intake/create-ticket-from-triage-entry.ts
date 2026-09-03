import type { ClassOfService } from '../class-of-service.js';
import type { Database } from '../schema.js';
import type { Severity } from '../severity.js';
import type {
  TicketRepositoryError,
  TicketResult,
} from '../ticket-lifecycle/tickets-repository.js';
import type { Ticket } from '../ticket.js';
import type { GithubIssueTriageEntry } from './github-issue-triage-entry.js';
import type { TicketGithubIssueLinkRepositoryError } from './ticket-github-issue-link-repository.js';
import type { TicketGithubIssueLink } from './ticket-github-issue-link.js';
import type { Kysely } from 'kysely';

import { PROJECT_KEY } from '../project-key.js';
import { createTicket } from '../ticket-lifecycle/tickets-repository.js';
import { linkTicketToExistingGithubIssue } from './ticket-github-issue-link-repository.js';

export type CreateTicketFromTriageEntryError =
  | { readonly step: 'create-ticket'; readonly error: TicketRepositoryError }
  | {
      readonly step: 'link';
      readonly error: TicketGithubIssueLinkRepositoryError;
    };

export type CreateTicketFromTriageEntryResult =
  | {
      readonly ok: true;
      readonly ticket: Ticket;
      readonly link: TicketGithubIssueLink;
    }
  | { readonly ok: false; readonly error: CreateTicketFromTriageEntryError };

// A module-private marker, not a domain error — same "force `db.transaction()` to roll back once
// a step has already returned a Result rather than throwing" shape `commit-ticket-draft.ts`'s own
// `RollbackWithError` uses, for the identical reason (neither `createTicket` nor
// `linkTicketToExistingGithubIssue` ever throws on its own).
class RollbackWithError extends Error {
  constructor(readonly failure: CreateTicketFromTriageEntryError) {
    super('rollback: ticket-from-triage-entry creation failed');
  }
}

/**
 * BUILD_PLAN 6.1b's inbound triage-to-ticket conversion — directly mirrors
 * `commit-ticket-draft.ts`'s `createTicketFromDraft`: one transaction, `createTicket` then
 * `linkTicketToExistingGithubIssue`, either step's failure rolls back the whole thing. This is
 * what makes conversion crash-safe: a mid-way crash leaves nothing committed, so the next pull-loop
 * tick's `findNextUnconvertedGithubIssueTriageEntry` finds the same entry still unconverted and
 * retries cleanly — no partial-state reconciliation needed, unlike 4.4b's own two-phase claim
 * (built for a genuine external-call-in-the-middle problem that doesn't exist here, since the
 * GitHub issue this converts already exists before the ticket does).
 *
 * `defaults` — `severity`/`classOfService` — are supplied by the caller as plain literals
 * (`'Medium'`/`'Standard'`), not imported constants: no `DEFAULT_SEVERITY`/`DEFAULT_CLASS_OF_SERVICE`
 * constant exists to import (`reaction-outcome-actions.ts`'s own `DEFAULT_SEVERITY` is
 * module-private, and there is no class-of-service equivalent — real class-of-service for
 * reaction-committed tickets is computed dynamically via `classifyClassOfService`, which returns
 * `'Expedite'` for either a `#moe-incidents` channel or `Critical` severity and `'Standard'`
 * otherwise; a GitHub-triage-sourced ticket has no Slack channel to classify against and always
 * gets the fixed `'Medium'` severity above — never `'Critical'` — so `'Standard'` here is just
 * that same non-Expedite output written directly, not a general claim about the function).
 * Same deterministic-not-LLM-set discipline (VISION §5.4) — the LLM composing a brief for this
 * ticket later never sees or sets either field.
 */
export async function createTicketFromTriageEntry(
  db: Kysely<Database>,
  entry: GithubIssueTriageEntry,
  defaults: {
    readonly severity: Severity;
    readonly classOfService: ClassOfService;
  },
): Promise<CreateTicketFromTriageEntryResult> {
  try {
    return await db.transaction().execute(async (trx) => {
      const created: TicketResult = await createTicket(trx, {
        projectKey: PROJECT_KEY,
        title: entry.title,
        status: 'Brief',
        severity: defaults.severity,
        classOfService: defaults.classOfService,
      });
      if (!created.ok) {
        throw new RollbackWithError({
          step: 'create-ticket',
          error: created.error,
        });
      }

      const linked = await linkTicketToExistingGithubIssue(trx, {
        ticketId: created.ticket.id,
        repoOwner: entry.repoOwner,
        repoName: entry.repoName,
        issueNumber: entry.issueNumber,
        issueUrl: entry.url,
      });
      if (!linked.ok) {
        throw new RollbackWithError({ step: 'link', error: linked.error });
      }

      return { ok: true, ticket: created.ticket, link: linked.link };
    });
  } catch (cause) {
    if (cause instanceof RollbackWithError) {
      return { ok: false, error: cause.failure };
    }
    return {
      ok: false,
      error: { step: 'create-ticket', error: { kind: 'unknown', cause } },
    };
  }
}
