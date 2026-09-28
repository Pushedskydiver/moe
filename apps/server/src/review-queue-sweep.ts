import type { Logger } from './logger.js';
import type {
  DraftOutcomeCounts,
  DraftOutcomeCountsResult,
  PendingConfirmingQuestion,
  PendingConfirmingQuestionListResult,
  ResolveConfirmingQuestionAndLogResult,
  ReviewQueueEntry,
  ReviewQueueEntryListResult,
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

// BUILD_PLAN 3.6 — the same 24-hour value as `SILENCE_THRESHOLD_MS`, reusing chunk 3.5's own
// "has the human had a fair chance to react" reasoning, but a separate named constant: this one
// classifies High-band ticket drafts, a conceptually distinct object from Mid-band confirming
// questions, and the two thresholds aren't architecturally coupled even though they share a value
// today. Alex confirmed via `AskUserQuestion`: without this, a draft posted moments before a sweep
// runs would count as "ignored" before anyone could plausibly have reacted to it yet.
const IGNORED_DRAFT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Named per `docs/CONVENTIONS.md`'s Code Style rule (three or more properties earn a named
// type) — mirrors `packages/core/src/intake/review-queue-repository.ts`'s own (non-exported)
// `ListReviewQueueEntriesSinceScope`, the scope type of the core function `listSince` is wired to
// (`listReviewQueueEntriesSince`). This file is the sweep's DI-testable core, not the script —
// `apps/server/scripts/review-queue-sweep.ts` is the thin real-infra wrapper that actually calls it.
type ListSinceScope = {
  readonly personaId: string;
  readonly since: Date;
  readonly until: Date;
};

// A standalone-script-scoped DI seam, not `HandlerDeps`'s own `reviewQueueStore`/
// `confirmingQuestionStore`/`draftStore` — this sweep needs `listSince`/`findStale`/
// `getOutcomeCounts`, methods the live message/reaction handlers never call, so widening those
// shared types would leak a sweep-only concern into the live server's own DI surface.
// `alertSlackUserId` reused as a bare string, not
// `HandlerDeps`'s own `costCapConfig` bundle — Alex confirmed via `AskUserQuestion` the same
// audience as the cost-cap alert ladder (`check-cost-cap.ts`), but this script has no cost-cap
// concern of its own to route through that bundle for. No `standing-proactive-guards.ts` check
// here either, deliberately — this Slack post only ever happens because Alex personally ran the
// script at a moment of his own choosing, and VISION §6.4's core-hours rule / §14's weekend rest
// rule govern a persona acting unprompted, not Alex-triggered admin tooling.
export type SweepDeps = {
  readonly personaId: string;
  readonly alertSlackUserId: string;
  readonly logger: Logger;
  readonly slackClient: PostMessageClient;
  // Injected clock (`docs/TESTING.md`'s mock-time boundary, `sender-trigger-cache.ts`'s own
  // precedent) — read once, after this run's own `'mid-silence'` writes, as the window's `until`
  // boundary. Deliberately separate from the `now` parameter below, which keeps its own existing
  // roles (the silence cutoff, the ignored-draft threshold) unchanged.
  readonly clock: () => Date;
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
    readonly listSince: (
      scope: ListSinceScope,
    ) => Promise<ReviewQueueEntryListResult>;
  };
  readonly confirmingQuestionStore: {
    readonly findStale: (scope: {
      readonly personaId: string;
      readonly olderThan: Date;
    }) => Promise<PendingConfirmingQuestionListResult>;
    readonly resolveAndLog: (input: {
      readonly questionId: string;
      readonly personaId: string;
      readonly outcomeReason: 'mid-no' | 'mid-silence';
    }) => Promise<ResolveConfirmingQuestionAndLogResult>;
  };
  readonly draftStore: {
    readonly getOutcomeCounts: (scope: {
      readonly personaId: string;
      readonly ignoredOlderThan: Date;
    }) => Promise<DraftOutcomeCountsResult>;
  };
};

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — matches `check-cost-cap.ts`'s `sendCostAlerts` precedent for sequential-by-
// design async work over a short list. `deps.confirmingQuestionStore.resolveAndLog` (`@moe/core`'s
// `resolveConfirmingQuestionAndLog`) atomically claims each question and writes its `review_queue`
// row in one transaction — the claim-then-act failure-recovery fix, shared with
// `reaction-outcome-actions.ts`'s own `logConfirmingQuestionAsNo` (`outcomeReason: 'mid-no'`),
// which had the identical shape before this fix. A claim that legitimately loses (`error.step ===
// 'claim'`, e.g. `'unavailable'`) means a real 👍/👎 answer raced this sweep and got there first —
// silently skipped, not an error; a downstream write failure (`error.step === 'log'`) is a real
// bug and gets logged, but the transaction has already rolled the claim back, so the question
// remains unresolved and will match `findStaleUnresolvedConfirmingQuestions` again on the next
// sweep run.
async function logStaleQuestionsAsSilent(
  deps: SweepDeps,
  questions: readonly PendingConfirmingQuestion[],
): Promise<void> {
  const [question, ...rest] = questions;
  if (question === undefined) return;

  const result = await deps.confirmingQuestionStore.resolveAndLog({
    questionId: question.id,
    personaId: deps.personaId,
    outcomeReason: 'mid-silence',
  });
  if (!result.ok && result.error.step === 'log') {
    deps.logger.error('failed to log Mid-band silence to review queue', {
      personaId: deps.personaId,
      questionId: question.id,
      errorMessage: repositoryErrorMessage(result.error.error),
    });
  }

  await logStaleQuestionsAsSilent(deps, rest);
}

// Alex confirmed via `AskUserQuestion` (BUILD_PLAN 3.5): surface the per-cause `outcomeReason`
// origin to the human reader, not one flat list — grouped so Alex can tell "nobody answered" from
// "the classifier itself wasn't confident" at a glance, not just a bare score. Three-way at ship
// time; the claim-then-act fallback fix later added a 4th value, `'mid-yes-failed'`, BUILD_PLAN 3.9
// added the two off-hours values, BUILD_PLAN 3.10 added the four cost-cap/
// appropriateness-check-failed values (the guard chain's other two silent-loss exits), and
// BUILD_PLAN 3.11 added `'classification-failed'` — the classifier call itself erroring, one step
// upstream of everything else in this list, before a band is ever determined. BUILD_PLAN 5.3a
// added the two `'…-repeated-sender'` values — `evaluateSenderFrequencyGuard`'s own squeaky-wheel
// block, a second High/Mid-band trigger from the same sender in the same channel suppressed
// within a 15-minute cooldown window.
//
// The 3.9/3.10/3.11 labels say "not drafted"/"not asked"/"not classified" rather than anything like
// "deferred": nothing picks these up for a later retry (genuine deferral is 3.9's own
// still-unbuilt step (2) — BUILD_PLAN 6.1a-i's pull loop now has a real recurring timer, but
// nothing wires this deferred-post behavior through it; 7.2a's ceremony scheduler is the other
// still-open path), so a label promising a later pickup would restate in the digest exactly the
// false promise 3.9 was filed to remove. They are listed **first deliberately**, not alphabetically
// or by age: `formatSweepMessage` derives its section order from this object's own key order
// (`Object.keys`).
//
// **The placement test is two-part, not one — the second group needs an OR, and stating only its
// first branch is exactly how BUILD_PLAN 3.11's own DA review caught the previous wording
// understating it.** A value belongs in the quieter **second** group only if the message's fate was
// genuinely, definitively resolved: **either** (a) the classifier itself reached a real negative
// verdict — `'low-confidence'`, the whole point of the Low band — **or** (b) a Mid-band question
// actually got posted and ran to a real conclusion: answered 👎 (`'mid-no'`), timed out unanswered
// (`'mid-silence'`), or a 👍 answer's own downstream draft failed after the question was already
// claimed (`'mid-yes-failed'`). Neither branch alone covers the whole group — `'low-confidence'`
// satisfies (a) and fails (b); the three `mid-*` values satisfy (b) and fail (a) (a posted question
// implies the classifier's own judgement was *positive*, not negative) — so both branches are load-
// bearing, not redundant restatements of each other.
//
// Every other value belongs in the **first**, prominent group: the message's true worth is still
// genuinely unknown, because it was never resolved by either branch above. That covers two distinct
// causes — the classifier judged the message worth escalating and something downstream then blocked
// it before a human ever saw it (3.9's two off-hours values, 3.10's four guard-chain values), or the
// classifier never got the chance to judge it at all (3.11's `'classification-failed'`) — both are a
// sharper loss than a message the classifier looked at and dismissed, or a question that ran its
// course.
//
// Applying only "was anything put in front of a human" would misfile `'low-confidence'` up here,
// since nothing ever is. That is not hypothetical — this comment's previous wording did exactly
// that, in the course of fixing a *different* wrong universal about the same set, and R2 caught it.
// When placing a value, check it against **both** second-group branches above, not just one — a
// value can fail branch (a) and still belong in the second group via branch (b). The two 5.3a
// values fail both: nothing was posted (fails (b)), and the classifier's own verdict was positive,
// not negative (fails (a)) — same first-group placement as the other guard-chain blocks.
const SECTION_LABEL_BY_OUTCOME_REASON: Record<
  ReviewQueueEntry['outcomeReason'],
  string
> = {
  'classification-failed': 'Classifier failed — not classified',
  'high-band-off-hours': 'Off-hours — not drafted',
  'mid-band-off-hours': 'Off-hours — not asked',
  'high-band-cost-cap': 'Cost cap reached — not drafted',
  'mid-band-cost-cap': 'Cost cap reached — not asked',
  'high-band-appropriateness-check-failed':
    'Appropriateness check failed — not drafted',
  'mid-band-appropriateness-check-failed':
    'Appropriateness check failed — not asked',
  'high-band-repeated-sender': 'Repeated sender — not drafted',
  'mid-band-repeated-sender': 'Repeated sender — not asked',

  'low-confidence': 'Low confidence',
  'mid-no': 'Answered no',
  'mid-silence': 'No response',
  'mid-yes-failed': 'Draft failed',
};

// `entry.confidence` is `null` only for `'classification-failed'` rows (BUILD_PLAN 3.11) — there
// is no score to show, so the line shows the real error (`entry.reasoning`) instead of printing a
// literal "confidence null", which would read as an unhandled case rather than an intentional one.
function formatSweepEntryLine(entry: ReviewQueueEntry): string {
  return entry.confidence === null
    ? `• ${entry.sourceMessageText} (error: ${entry.reasoning})`
    : `• ${entry.sourceMessageText} (confidence ${entry.confidence})`;
}

function formatSweepSection(
  outcomeReason: ReviewQueueEntry['outcomeReason'],
  group: readonly ReviewQueueEntry[],
): string {
  return [
    `*${SECTION_LABEL_BY_OUTCOME_REASON[outcomeReason]} (${group.length})*`,
    ...group.map((entry) => formatSweepEntryLine(entry)),
  ].join('\n');
}

// BUILD_PLAN 3.6 — the rate is over TERMINAL outcomes only (`committed`/`ignored`); `redone`
// drafts are still open, not yet a real accept-or-reject signal, so they're shown as a raw count
// but excluded from the rate's own denominator, matching VISION §5.4's own framing ("the rate of
// ignored/rejected drafts"). `null` when there's no terminal data yet (a fresh persona, or every
// draft still too young to classify) rather than a misleading `0%`/`100%`.
function formatDraftOutcomesLine(counts: DraftOutcomeCounts): string {
  const terminalTotal = counts.committed + counts.ignored;
  const rate =
    terminalTotal === 0
      ? null
      : Math.round((counts.committed / terminalTotal) * 100);
  const rateSuffix = rate === null ? '' : ` — ${rate}% acceptance rate`;
  return (
    `📊 Draft outcomes (all time): ${counts.committed} committed, ` +
    `${counts.redone} redone (open), ${counts.ignored} ignored${rateSuffix}`
  );
}

// Section order/coverage derives from `SECTION_LABEL_BY_OUTCOME_REASON`'s own keys, not a second
// hardcoded literal array — a bare array here previously fell out of sync with a new
// `outcomeReason` value (the claim-then-act fallback fix's `'mid-yes-failed'` was added to the
// `Record` above, which TypeScript's exhaustiveness check would have caught, but not to a
// separate array, which has no such check — the exact "nothing is silently eaten" failure this
// whole sweep exists to prevent, recurring inside its own digest). `Object.keys` loses the
// literal-union typing `Record`'s own keys have — the cast recovers it, safe here specifically
// because `SECTION_LABEL_BY_OUTCOME_REASON`'s own `Record<ReviewQueueEntry['outcomeReason'],
// string>` type already guarantees its keys are exactly `ReviewQueueEntry['outcomeReason']`.
// `draftOutcomes` is `null` when the counts fetch itself failed (`postSweepDigest`'s own
// concern, logged there) — the review-queue digest itself is the sweep's real purpose and still
// goes out without the draft-outcomes line rather than being blocked by this enrichment failing.
function formatSweepMessage(
  entries: readonly ReviewQueueEntry[],
  draftOutcomes: DraftOutcomeCounts | null,
): string {
  const header = `📋 Review-queue sweep — ${entries.length} item${entries.length === 1 ? '' : 's'} since last run`;
  const draftOutcomesLine =
    draftOutcomes === null ? null : formatDraftOutcomesLine(draftOutcomes);

  const outcomeReasons = Object.keys(
    SECTION_LABEL_BY_OUTCOME_REASON,
  ) as ReviewQueueEntry['outcomeReason'][];
  const sections = outcomeReasons
    .map((outcomeReason) => ({
      outcomeReason,
      group: entries.filter((entry) => entry.outcomeReason === outcomeReason),
    }))
    .filter(({ group }) => group.length > 0)
    .map(({ outcomeReason, group }) =>
      formatSweepSection(outcomeReason, group),
    );

  return [
    header,
    ...(draftOutcomesLine === null ? [] : [draftOutcomesLine]),
    ...sections,
  ].join('\n\n');
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
      errorMessage: repositoryErrorMessage(stale.error),
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
        errorMessage: repositoryErrorMessage(state.error),
      },
    );
  }
  return state.ok && state.state !== null
    ? state.state.lastSweptAt
    : new Date(0);
}

// BUILD_PLAN 3.6 — fetches the draft-outcome counts to enrich the digest with; a failure here logs
// and returns `null` rather than aborting `postSweepDigest`'s own real purpose (the review-queue
// digest itself). `null` also skips the draft-outcomes line entirely in `formatSweepMessage`
// (rather than showing a misleading all-zero line) when the fetch didn't succeed.
async function fetchDraftOutcomeCounts(
  deps: SweepDeps,
  now: Date,
): Promise<DraftOutcomeCounts | null> {
  const result = await deps.draftStore.getOutcomeCounts({
    personaId: deps.personaId,
    ignoredOlderThan: new Date(now.getTime() - IGNORED_DRAFT_THRESHOLD_MS),
  });
  if (!result.ok) {
    deps.logger.error('failed to fetch draft outcome counts', {
      personaId: deps.personaId,
      errorMessage: repositoryErrorMessage(result.error),
    });
    return null;
  }
  return result.counts;
}

// Extracted from `runReviewQueueSweep` purely to stay under eslint's `max-lines-per-function` —
// DMs Alex a formatted digest (`formatSweepMessage`), skipped entirely (just logged) when
// there's nothing new to report. Returns whether the sweep's own `(since, until]` window is now
// safe to advance — `true` for both "nothing to report" and "posted successfully," `false` only
// when a real digest existed but the post itself failed (DA review, chunk 3.5: `sweep_state` must
// not advance past rows Alex was never actually shown, or this backstop defeats its own purpose —
// those rows would never appear in a future digest either, since `listReviewQueueEntriesSince`'s
// own `since` boundary would already be past them). The draft-outcome counts (BUILD_PLAN 3.6) are
// only fetched here, alongside an existing post — surfacing them "in the 3.5 sweep post" per
// BUILD_PLAN's own text, not as an independent trigger that would post even when review_queue
// itself has nothing new (a lifetime-cumulative count is almost never zero once any High-band
// draft has ever existed, so treating it as its own trigger would defeat the "quiet when nothing
// new" behavior the digest already has).
async function postSweepDigest(
  deps: SweepDeps,
  entries: readonly ReviewQueueEntry[],
  now: Date,
): Promise<boolean> {
  if (entries.length === 0) {
    deps.logger.info('review-queue sweep found nothing new', {
      personaId: deps.personaId,
    });
    return true;
  }

  const draftOutcomes = await fetchDraftOutcomeCounts(deps, now);

  const posted = await postMessage(deps.slackClient, {
    channelId: deps.alertSlackUserId,
    text: formatSweepMessage(entries, draftOutcomes),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post review-queue sweep', {
      personaId: deps.personaId,
      errorMessage: posted.error.message,
    });
    return false;
  }

  return true;
}

/**
 * BUILD_PLAN 3.5's own review-queue sweep — VISION §5.2's "nothing is silently eaten" backstop,
 * finally given a real reader. Triggered manually (Alex confirmed via `AskUserQuestion`: a CLI
 * script, `apps/server/scripts/review-queue-sweep.ts`'s own thin real-infra wrapper around this function — not
 * a background timer, since the codebase had no scheduled-job infrastructure at chunk 3.5 and
 * chunk 7.2a's own future ceremony scheduler is the real home for that, not this chunk).
 *
 * Lists the `review_queue` rows created in `(lastSweptAt, until]`, where `until` is read from
 * `deps.clock()` *after* `resolveStaleQuestionsAndSweepWindow` writes this run's own
 * `'mid-silence'` rows (so this run's own writes normally fall inside the window — exceptions (3)
 * and (4) below name when they don't), and DMs a formatted digest
 * (`postSweepDigest`) — which now also carries BUILD_PLAN 3.6's own lifetime-cumulative High-band
 * draft-outcome counts (`fetchDraftOutcomeCounts`), VISION §5.4's named production metric for the
 * whole intake cascade. `sweep_state` is only updated, to `until` (not `now`), once both listing
 * *and* posting actually succeed — normally an advance, though exception (3) below can move it
 * back — either failure leaves it untouched, so the next run re-covers
 * the same window rather than silently skipping past rows Alex was never shown (DA review, chunk
 * 3.5: the posting-failure half of this was originally missed — `sweep_state` advanced
 * unconditionally after `postSweepDigest`, defeating this very backstop's own purpose).
 *
 * Reading `until` after this run's own writes, and recording it (not `now`) as the next
 * `lastSweptAt`, keeps consecutive completed sweeps' windows from overlapping (a row reported
 * twice) or gapping (a row missed) in the common case — but not always. Assuming one sweep per
 * persona at a time (`sweep-state-repository.ts`), four exceptions remain; (1)–(3) re-report
 * rows, (4) misses them, and only (1) and (2) are logged:
 * 1. **State-read fallback (overlap):** a failed `getSweepState` falls back to `since = new
 *    Date(0)` (`resolveStaleQuestionsAndSweepWindow`, above) rather than aborting, so that run's
 *    window overlaps every earlier completed one.
 * 2. **Record failure after a successful post (overlap):** a failed `recordSweepCompleted` after
 *    listing and posting both succeed leaves `lastSweptAt` where it was, so the next run's window
 *    overlaps the rows Alex was already shown.
 * 3. **Clock reading backward (overlap):** if this run's clock reads `until` earlier than the
 *    stored `lastSweptAt` — the host's clock corrected backward, or the script run from a machine
 *    whose clock lags the last one — the listing `(since, until]` is empty and recording `until`
 *    moves the window back, so the next run's window reaches back over `(until, since]`,
 *    re-reporting any row there that an earlier sweep already listed. Recording `until` rather
 *    than holding `since` is deliberate: when the stored `lastSweptAt` came from a clock that was
 *    running fast, holding it would skip every row later stamped in `(until, since]`.
 * 4. **Stamp-versus-listing ordering (gap):** a row stamped at or before one window's `until` can
 *    be invisible to that window's listing and then fall at or below the next window's `since` —
 *    its insert committed after the listing ran, or the clock that stamped it lagged the clock
 *    that read `until` (clock skew between the CLI host and a persona's machine, or this run's own
 *    `'mid-silence'` writes when they are stamped at or before the stored `lastSweptAt` — always
 *    the case when (3) applies). It is bounded by commit latency plus clock skew, and nothing
 *    detects or logs it.
 *
 * (1)–(3) are re-reports, not misses — the same rule `resolveStaleQuestionsAndSweepWindow`'s own
 * comment states above: over-reporting an already-seen row is far lower-risk than silently
 * missing one. (4) is the one true gap.
 *
 * `now` keeps its own separate, pre-existing roles unchanged: the Mid-band silence cutoff and the
 * ignored-draft threshold, both computed relative to when this run started, not to `until`.
 */
export async function runReviewQueueSweep(
  deps: SweepDeps,
  now: Date,
): Promise<void> {
  const since = await resolveStaleQuestionsAndSweepWindow(deps, now);
  const until = deps.clock();

  const entries = await deps.reviewQueueStore.listSince({
    personaId: deps.personaId,
    since,
    until,
  });
  if (!entries.ok) {
    deps.logger.error('failed to list review-queue entries', {
      personaId: deps.personaId,
      errorMessage: repositoryErrorMessage(entries.error),
    });
    return;
  }

  const posted = await postSweepDigest(deps, entries.entries, now);
  if (!posted) return;

  const recorded = await deps.sweepStateStore.recordSweepCompleted({
    personaId: deps.personaId,
    sweptAt: until,
  });
  if (!recorded.ok) {
    deps.logger.error('failed to record sweep completion', {
      personaId: deps.personaId,
      errorMessage: repositoryErrorMessage(recorded.error),
    });
  }
}
