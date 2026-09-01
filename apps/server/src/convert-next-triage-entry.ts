import type { Logger } from './logger.js';
import type {
  CreateTicketFromTriageEntryResult,
  GithubIssueTriageEntry,
  GithubIssueTriageEntryOrNullResult,
} from '@moe/core';

import { repositoryErrorMessage } from './repository-error.js';

// A pull-loop-pre-tick-step-only DI seam, not `PullLoopBehaviorDeps` in full — mirrors
// `pull-loop.ts`'s own `PullLoopDeps.ticketStore` precedent: this step needs exactly
// `findNextUnconverted`/`convert`, methods no other handler in this app calls.
export type ConvertNextTriageEntryDeps = {
  readonly triageStore: {
    readonly findNextUnconverted: () => Promise<GithubIssueTriageEntryOrNullResult>;
    readonly convert: (
      entry: GithubIssueTriageEntry,
    ) => Promise<CreateTicketFromTriageEntryResult>;
  };
  readonly logger: Logger;
};

/**
 * BUILD_PLAN 6.1b's own triage-queue-to-ticket conversion pre-tick step — Alex's confirmed scope
 * decision 3: automatic, at most one unconverted `github_issue_triage` entry converted into a new
 * board ticket per pull-loop tick, atomic and crash-safe. The "at most one" bound falls directly
 * out of this function's own shape: it finds and (if found) converts exactly one entry per call,
 * and `runPullLoopTick` calls the returned `preTickStep` exactly once per in-hours tick
 * (`pull-loop.ts`) — no explicit counter or loop needed. `createTicketFromTriageEntry`'s own
 * transaction (`@moe/core`) is what makes a single conversion crash-safe; this function doesn't
 * add any of its own atomicity, only sequences the find-then-convert pair and logs either
 * failure. Returns a closure matching `PullLoopDeps.preTickStep`'s own `(now: Date) => Promise<void>`
 * shape — `now` itself goes unused (neither `findNextUnconverted` nor `convert` needs it), same
 * "fewer params than the type requires" shape `resolvePullLoopBehaviors`'s own no-op fallback
 * uses for a persona with nothing to do.
 */
export function createConvertNextTriageEntryPreTickStep(
  deps: ConvertNextTriageEntryDeps,
): () => Promise<void> {
  return async () => {
    const found = await deps.triageStore.findNextUnconverted();
    if (!found.ok) {
      deps.logger.error(
        'failed to find next unconverted github issue triage entry',
        { errorMessage: repositoryErrorMessage(found.error) },
      );
      return;
    }
    if (found.entry === null) {
      return;
    }

    const created = await deps.triageStore.convert(found.entry);
    if (!created.ok) {
      deps.logger.error(
        'failed to convert github issue triage entry into a ticket',
        {
          step: created.error.step,
          repoOwner: found.entry.repoOwner,
          repoName: found.entry.repoName,
          issueNumber: found.entry.issueNumber,
          errorMessage: repositoryErrorMessage(created.error.error),
        },
      );
      return;
    }

    deps.logger.info(
      'converted a github issue triage entry into a new ticket',
      {
        ticketId: created.ticket.id,
        repoOwner: found.entry.repoOwner,
        repoName: found.entry.repoName,
        issueNumber: found.entry.issueNumber,
      },
    );
  };
}
