import type { Logger } from './logger.js';
import type {
  NewReviewQueueEntry,
  PendingConfirmingQuestion,
  PendingConfirmingQuestionClaimResult,
  PendingConfirmingQuestionListResult,
  ReviewQueueEntry,
  ReviewQueueEntryListResult,
  ReviewQueueEntryResult,
  SweepStateOrNullResult,
  SweepStateResult,
} from '@moe/core';

import { postMessage } from '@moe/slack';

import { repositoryErrorMessage } from './repository-error.js';

type PostMessageClient = Parameters<typeof postMessage>[0];

// Alex confirmed via `AskUserQuestion` (BUILD_PLAN 3.5): an unresolved confirming question past
// this age counts as "silence," VISION §5.2's third Mid-band outcome alongside a real 👍/👎
// answer. A plain named constant, not env-configurable — same "cheap to change later" reasoning
// as `compose-and-post-confirming-question.ts`'s own fixed-template wording, not a
// schema/architecture choice worth a config parameter yet.
const SILENCE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// A standalone-script-scoped DI seam, not `HandlerDeps`'s own `reviewQueueStore`/
// `confirmingQuestionStore` — this sweep needs `listSince`/`findStale`, methods the live
// message/reaction handlers never call, so widening those shared types would leak a sweep-only
// concern into the live server's own DI surface. `alertSlackUserId` reused as a bare string, not
// `HandlerDeps`'s own `costCapConfig` bundle — Alex confirmed via `AskUserQuestion` the same
// audience as the cost-cap alert ladder (`check-cost-cap.ts`), but this script has no cost-cap
// concern of its own to route through that bundle for. No `standing-proactive-guards.ts` check
// here either, deliberately — this Slack post only ever happens because Alex personally ran the
// script at a moment of his own choosing, and VISION §14's core-hours/weekend rest rule governs a
// persona acting unprompted, not Alex-triggered admin tooling.
export type SweepDeps = {
  readonly personaId: string;
  readonly alertSlackUserId: string;
  readonly logger: Logger;
  readonly slackClient: PostMessageClient;
  readonly sweepStateStore: {
    readonly getSweepState: (
      personaId: string,
    ) => Promise<SweepStateOrNullResult>;
    readonly recordSweepCompleted: (input: {
      readonly personaId: string;
      readonly sweptAt: Date;
    }) => Promise<SweepStateResult>;
  };
  readonly reviewQueueStore: {
    readonly listSince: (scope: {
      readonly personaId: string;
      readonly since: Date;
    }) => Promise<ReviewQueueEntryListResult>;
    readonly create: (
      input: NewReviewQueueEntry,
    ) => Promise<ReviewQueueEntryResult>;
  };
  readonly confirmingQuestionStore: {
    readonly findStale: (scope: {
      readonly personaId: string;
      readonly olderThan: Date;
    }) => Promise<PendingConfirmingQuestionListResult>;
    readonly resolve: (
      id: string,
    ) => Promise<PendingConfirmingQuestionClaimResult>;
  };
};

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — matches `check-cost-cap.ts`'s `sendCostAlerts` precedent for sequential-by-
// design async work over a short list. Each question gets its own atomic claim
// (`confirmingQuestionStore.resolve`) before being logged as silent — the same race-safe backstop
// `draftFromConfirmingQuestion`/`logConfirmingQuestionAsNo` already use, so a real 👍/👎 answer
// racing this sweep always wins: a claim that fails here (`ok: false`) means a real answer got
// there first, silently skipped, not an error.
//
// Known, accepted gap (DA review, chunk 3.5): a third instance of the claim-then-act shape
// `reaction-outcome-actions.ts`'s own `draftFromConfirmingQuestion`/`commitAsTicket` already carry
// — if the claim above succeeds but `reviewQueueStore.create` then fails, the question is left
// permanently resolved with no `review_queue` row and no future retry path (this question can
// never match `findStaleUnresolvedConfirmingQuestions` again). Same tracked follow-up as the other
// two instances (a shared fallback design across all three call sites, not a one-off patch here).
async function logStaleQuestionsAsSilent(
  deps: SweepDeps,
  questions: readonly PendingConfirmingQuestion[],
): Promise<void> {
  const [question, ...rest] = questions;
  if (question === undefined) return;

  const claimed = await deps.confirmingQuestionStore.resolve(question.id);
  if (claimed.ok) {
    const created = await deps.reviewQueueStore.create({
      personaId: deps.personaId,
      channelId: claimed.question.channelId,
      messageTs: claimed.question.sourceMessageTs,
      sourceMessageText: claimed.question.sourceMessageText,
      confidence: claimed.question.confidence,
      reasoning: claimed.question.reasoning,
      outcomeReason: 'mid-silence',
    });
    if (!created.ok) {
      deps.logger.error('failed to log Mid-band silence to review queue', {
        personaId: deps.personaId,
        questionId: question.id,
        message: repositoryErrorMessage(created.error),
      });
    }
  }

  await logStaleQuestionsAsSilent(deps, rest);
}

// Alex confirmed via `AskUserQuestion` (BUILD_PLAN 3.5): surface the three-way `outcomeReason`
// origin to the human reader, not one flat list — grouped so Alex can tell "nobody answered" from
// "the classifier itself wasn't confident" at a glance, not just a bare score.
const SECTION_LABEL_BY_OUTCOME_REASON: Record<
  ReviewQueueEntry['outcomeReason'],
  string
> = {
  'low-confidence': 'Low confidence',
  'mid-no': 'Answered no',
  'mid-silence': 'No response',
};

function formatSweepSection(
  outcomeReason: ReviewQueueEntry['outcomeReason'],
  group: readonly ReviewQueueEntry[],
): string {
  return [
    `*${SECTION_LABEL_BY_OUTCOME_REASON[outcomeReason]} (${group.length})*`,
    ...group.map(
      (entry) =>
        `• ${entry.sourceMessageText} (confidence ${entry.confidence})`,
    ),
  ].join('\n');
}

function formatSweepMessage(entries: readonly ReviewQueueEntry[]): string {
  const header = `📋 Review-queue sweep — ${entries.length} item${entries.length === 1 ? '' : 's'} since last run`;

  const sections = (['low-confidence', 'mid-no', 'mid-silence'] as const)
    .map((outcomeReason) => ({
      outcomeReason,
      group: entries.filter((entry) => entry.outcomeReason === outcomeReason),
    }))
    .filter(({ group }) => group.length > 0)
    .map(({ outcomeReason, group }) =>
      formatSweepSection(outcomeReason, group),
    );

  return [header, ...sections].join('\n\n');
}

// Extracted from `runReviewQueueSweep` purely to stay under eslint's `max-lines-per-function`
// (`docs/CONVENTIONS.md` §Code Style) — resolves any confirming question past
// `SILENCE_THRESHOLD_MS` unresolved as `'mid-silence'` (so this run's own digest includes it),
// then resolves the sweep's own "since" boundary — a persona-scoped `sweep_state` value, falling
// back to the beginning of time (not aborting) if that read itself fails, since over-reporting an
// already-seen row is far lower-risk than silently missing one.
async function resolveStaleQuestionsAndSweepWindow(
  deps: SweepDeps,
  now: Date,
): Promise<Date> {
  const cutoff = new Date(now.getTime() - SILENCE_THRESHOLD_MS);
  const stale = await deps.confirmingQuestionStore.findStale({
    personaId: deps.personaId,
    olderThan: cutoff,
  });
  if (!stale.ok) {
    deps.logger.error('failed to find stale confirming questions', {
      personaId: deps.personaId,
      message: repositoryErrorMessage(stale.error),
    });
  } else {
    await logStaleQuestionsAsSilent(deps, stale.questions);
  }

  const state = await deps.sweepStateStore.getSweepState(deps.personaId);
  if (!state.ok) {
    deps.logger.error(
      'failed to read sweep state — falling back to sweeping from the beginning',
      {
        personaId: deps.personaId,
        message: repositoryErrorMessage(state.error),
      },
    );
  }
  return state.ok && state.state !== null
    ? state.state.lastSweptAt
    : new Date(0);
}

// Extracted from `runReviewQueueSweep` purely to stay under eslint's `max-lines-per-function` —
// DMs Alex a formatted digest (`formatSweepMessage`), skipped entirely (just logged) when
// there's nothing new to report. Returns whether the sweep's own "since" window is now safe to
// advance — `true` for both "nothing to report" and "posted successfully," `false` only when a
// real digest existed but the post itself failed (DA review, chunk 3.5: `sweep_state` must not
// advance past rows Alex was never actually shown, or this backstop defeats its own purpose —
// those rows would never appear in a future digest either, since `listReviewQueueEntriesSince`'s
// own `since` boundary would already be past them).
async function postSweepDigest(
  deps: SweepDeps,
  entries: readonly ReviewQueueEntry[],
): Promise<boolean> {
  if (entries.length === 0) {
    deps.logger.info('review-queue sweep found nothing new', {
      personaId: deps.personaId,
    });
    return true;
  }

  const posted = await postMessage(deps.slackClient, {
    channelId: deps.alertSlackUserId,
    text: formatSweepMessage(entries),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post review-queue sweep', {
      personaId: deps.personaId,
      message: posted.error.message,
    });
    return false;
  }

  return true;
}

/**
 * BUILD_PLAN 3.5's own review-queue sweep — VISION §5.2's "nothing is silently eaten" backstop,
 * finally given a real reader. Triggered manually (Alex confirmed via `AskUserQuestion`: a CLI
 * script, `scripts/review-queue-sweep.ts`'s own thin real-infra wrapper around this function —
 * not a background timer, since the codebase has no scheduled-job infrastructure and chunk 7.2a's
 * own future ceremony scheduler is the real home for that, not this chunk). Lists every
 * `review_queue` row created since this persona's last sweep
 * (`resolveStaleQuestionsAndSweepWindow`, including any `'mid-silence'` rows this very run just
 * wrote) and DMs a formatted digest (`postSweepDigest`). `sweep_state` is only advanced once
 * both listing *and* posting actually succeed — either failure leaves it untouched, so the next
 * run re-covers the same window rather than silently skipping past rows Alex was never shown
 * (DA review, chunk 3.5: the posting-failure half of this was originally missed — `sweep_state`
 * advanced unconditionally after `postSweepDigest`, defeating this very backstop's own purpose).
 */
export async function runReviewQueueSweep(
  deps: SweepDeps,
  now: Date,
): Promise<void> {
  const since = await resolveStaleQuestionsAndSweepWindow(deps, now);

  const entries = await deps.reviewQueueStore.listSince({
    personaId: deps.personaId,
    since,
  });
  if (!entries.ok) {
    deps.logger.error('failed to list review-queue entries', {
      personaId: deps.personaId,
      message: repositoryErrorMessage(entries.error),
    });
    return;
  }

  const posted = await postSweepDigest(deps, entries.entries);
  if (!posted) return;

  const recorded = await deps.sweepStateStore.recordSweepCompleted({
    personaId: deps.personaId,
    sweptAt: now,
  });
  if (!recorded.ok) {
    deps.logger.error('failed to record sweep completion', {
      personaId: deps.personaId,
      message: repositoryErrorMessage(recorded.error),
    });
  }
}
