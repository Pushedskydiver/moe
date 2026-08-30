import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import {
  evaluateSituationalAppropriateness,
  haikuCostUsdMicros,
} from '@moe/agents';
import { evaluateOperatingRhythm } from '@moe/core';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { recordUsageLogged } from './record-usage-logged.js';

// Extracted from `handle-ambient-channel-message.ts` (BUILD_PLAN 3.4b-i) once a second standing-
// proactive action — the Mid-band confirming question, `compose-and-post-confirming-question.ts`
// — needed the exact same two guards the High-band draft path already had: a genuine 2+-consumer
// case, not premature abstraction. `actionDescription` parameterizes only the log-message text
// (e.g. `'ticket-draft composition'` vs `'confirming-question posting'`) — every other behavior is
// byte-identical to the pre-extraction functions, verified by the High-band path's own existing
// tests staying green unchanged after this extraction.

// Bundled into one object, not 3 more params — both guard functions below would otherwise cross
// eslint's `max-params: 3`, same reasoning `check-cost-cap.ts`'s own `sendCostAlerts` input
// bundling already documents. Not exported — both consumers (`handle-ambient-channel-message.ts`,
// `compose-and-post-confirming-question.ts`) build this object structurally inline rather than
// importing the type by name.
type StandingProactiveGuardInput = {
  readonly message: InboundMessage;
  readonly now: Date;
  readonly actionDescription: string;
};

/**
 * A boolean-discriminated union, same shape as `CostAndRhythmGuardDecision`/
 * `SituationalAppropriatenessGuardDecision` below, for the identical `docs/CONVENTIONS.md`
 * reasoning — a single blocking reason today, but the union shape costs nothing and stays
 * consistent with its two siblings rather than being the one guard decision in this file that
 * doesn't narrow.
 */
export type SenderFrequencyGuardDecision =
  | { readonly satisfied: true; readonly reason: 'satisfied' }
  | { readonly satisfied: false; readonly reason: 'repeated-sender' };

/**
 * BUILD_PLAN 5.3a's squeaky-wheel guard — the PM-persona research surfaced that message
 * frequency/repetition alone shouldn't raise triage confidence or trigger repeated action
 * (evidenced independently in both LLM-sycophancy and PM-industry-practice research; full
 * findings: `.claude/research/pm-persona-landscape/landscape-survey.md`). Alex settled
 * (`AskUserQuestion`, 2026-07-29) the concrete shape: a standing guard in this same chain, scoped
 * to the same (persona, channel, sender) triple, 15-minute window, second trigger blocks —
 * `sender-trigger-cache.ts` owns the actual cache/window mechanics, this function only adapts its
 * `boolean` result into this file's own decision shape and logs.
 *
 * **Runs first, unlike the other two guards below, and is the only one of the three that isn't
 * `async`.** The cache check is a synchronous in-memory `Map` lookup with no I/O — placing it
 * ahead of `evaluateCostAndRhythmGuard`'s DB read and `evaluateSituationalAppropriatenessGuard`'s
 * billed Haiku call avoids paying for either on a message this guard is about to suppress anyway,
 * the identical "avoid spend for no protection" reasoning `composeAndPostDraft`'s own TSDoc
 * already applies to its guard ordering.
 *
 * **Always writes a `review_queue` row on block, unlike the appropriateness guard's
 * `'inappropriate'` branch** — a repeated trigger within the cooldown window is an infrastructure-
 * shaped suppression (the message may still be real, distinct work), not a considered verdict that
 * it shouldn't be acted on, so it gets the same "nothing silently eaten" treatment as the
 * cost-and-rhythm guard's two reasons.
 */
export function evaluateSenderFrequencyGuard(
  deps: HandlerDeps,
  input: StandingProactiveGuardInput,
): SenderFrequencyGuardDecision {
  const { message, actionDescription } = input;
  const blocked = deps.senderTriggerCache.checkAndRecord({
    personaId: deps.personaId,
    channelId: message.channelId,
    userId: message.userId,
  });
  if (blocked) {
    deps.logger.info(
      `skipping ${actionDescription} — repeated sender within cooldown window`,
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        userId: message.userId,
      },
    );
    return { satisfied: false, reason: 'repeated-sender' };
  }

  return { satisfied: true, reason: 'satisfied' };
}

/**
 * A boolean-discriminated union, mirroring `@moe/core`'s own
 * `OperatingRhythmDecision`/`WipLimitDecision` — the two existing `*Decision` types, which is where
 * this shape comes from. **`docs/CONVENTIONS.md` prescribes the `evaluate*` verb, not the return
 * shape**, and its `Result`-shaped-discriminated-union rule is explicitly scoped to "expected
 * domain failures" (a Slack/GitHub call failing, a validation failing) — a guard reporting a
 * decision is not one, which is why this shape is the right precedent to follow here rather than
 * `evaluateSituationalAppropriateness`'s `Result`. Both readings were checked against
 * `docs/CONVENTIONS.md` directly after two review passes disagreed about it.
 *
 * The two blocking reasons are deliberately distinguishable (BUILD_PLAN 3.9): they mean different
 * things and now have different consequences — an off-hours block writes a `review_queue` row so
 * the message survives, a cost-cap halt does too as of BUILD_PLAN 3.10 (with its own distinct
 * label). Before 3.9 both collapsed into a bare `false` and no caller could tell them apart, which
 * is precisely why they couldn't be handled separately.
 *
 * **A discriminated union on `satisfied`, not a flat `{satisfied: boolean, reason: ...}` object**
 * (BUILD_PLAN 3.10) — the flat shape shipped at 3.9 didn't actually narrow `reason` inside an
 * `if (!guard.satisfied)` block, so a caller mapping each blocking reason to its own outcome label
 * had no compile-time help catching a missed case if a third reason were ever added. This shape
 * costs nothing at the two call sites (both already destructure/branch on `satisfied` first) and
 * buys real exhaustiveness checking where it matters.
 */
export type CostAndRhythmGuardDecision =
  | { readonly satisfied: true; readonly reason: 'satisfied' }
  | {
      readonly satisfied: false;
      readonly reason: 'cost-cap-reached' | 'outside-core-hours';
    };

/**
 * Cost-cap-then-operating-rhythm guard shared by every standing-proactive Slack post. Cost-cap
 * checked before the operating-rhythm guard, not after — DA review (chunk 3.4a-iii) noted the
 * reverse order would save a DB round-trip during the (majority of) off-hours wall-clock time, but
 * this order lets cost-cap-only tests pin the cap without also needing to pin `now` into the
 * core-hours window, since `checkCostCapAndAlert`'s halt short-circuits before
 * `evaluateOperatingRhythm` ever runs.
 *
 * **Renamed from `isCostAndRhythmGuardSatisfied` at BUILD_PLAN 3.9**, when the return widened from
 * a bare `boolean` to the decision above: `docs/CONVENTIONS.md` reserves the `is*` prefix for
 * boolean predicates and names `evaluate*` for "a decision derived from given inputs", which is
 * what this now returns.
 *
 * **Neither branch persists anything, and this function deliberately does not write the
 * `review_queue` row itself** — the classifier's `confidence`/`reasoning` is not in scope here, and
 * only the *ambient* callers should write one (a DM never reaches this function at all). The
 * callers own that decision; see `logAmbientIntakeToReviewQueue`.
 */
export async function evaluateCostAndRhythmGuard(
  deps: HandlerDeps,
  input: StandingProactiveGuardInput,
): Promise<CostAndRhythmGuardDecision> {
  const { message, now, actionDescription } = input;
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info(
      `skipping ${actionDescription} — monthly cost cap reached`,
      {
        personaId: deps.personaId,
        channelId: message.channelId,
      },
    );
    return { satisfied: false, reason: 'cost-cap-reached' };
  }

  const rhythm = await evaluateOperatingRhythm(now, deps.bankHolidaysCache);
  if (!rhythm.withinCoreHours) {
    // "skipping", not "deferring" — BUILD_PLAN 3.9. This function defers nothing: it returns, and
    // the caller stops. The ambient callers now write a `review_queue` row off the back of this
    // reason, but that is a durable record for the 3.5 sweep digest, not a scheduled retry —
    // genuine deferral is 3.9's own step (2), still unbuilt. BUILD_PLAN 6.1a-i's pull loop now has
    // a real recurring timer, but nothing wires this deferred-post behavior through it; 7.2a's
    // ceremony scheduler is the other still-open path either could re-enter through.
    // The old wording claimed a pickup that no code performs, and it is why a real production
    // drop read as working-as-intended in the logs.
    deps.logger.info(`skipping ${actionDescription} — outside core hours`, {
      personaId: deps.personaId,
      channelId: message.channelId,
      reason: rhythm.reason,
    });
    return { satisfied: false, reason: 'outside-core-hours' };
  }

  return { satisfied: true, reason: 'satisfied' };
}

/**
 * A boolean-discriminated union, mirroring `CostAndRhythmGuardDecision`'s own shape (including its
 * TSDoc's reasoning for why this is a union rather than a flat object) and the same
 * `docs/CONVENTIONS.md` reasoning for why it's a decision, not an expected domain failure.
 *
 * The two blocking reasons are deliberately distinguishable (BUILD_PLAN 3.10), mirroring
 * `CostAndRhythmGuardDecision`'s own split at 3.9: `'evaluation-failed'` is an infrastructure blip
 * (an Anthropic error, timeout, or unparseable response) — a genuine remaining silent loss that
 * permanently drops a message that may well have been a real bug report, so the **ambient**
 * callers write a `review_queue` row for it. `'inappropriate'` is a real, considered
 * `appropriate: false` verdict — Alex settled (`AskUserQuestion`, 2026-07-28) that this one stays
 * silent, since it is a genuine judgement that the message should not be acted on, not silent data
 * loss the queue exists to catch. Before 3.10 both collapsed into a bare `false` and no caller
 * could tell them apart, which is precisely why the infra-blip case could not be handled
 * separately from the genuine-verdict one.
 *
 * **Unlike `CostAndRhythmGuardDecision`, there is no safe universal default for a hypothetical
 * third reason here** — an infra blip should log, a considered verdict should not, and neither is
 * "more correct" to default to. The exhaustiveness this union buys is exactly what forces a real
 * decision on any future third reason instead of it silently falling through to whichever behavior
 * an equality/inequality check happened to spell.
 */
export type SituationalAppropriatenessGuardDecision =
  | { readonly satisfied: true; readonly reason: 'satisfied' }
  | {
      readonly satisfied: false;
      readonly reason: 'inappropriate' | 'evaluation-failed';
    };

/**
 * BUILD_PLAN 3.4a-iii's own situational-appropriateness gate (VISION §9), run before any
 * standing-proactive Slack post — Alex confirmed via `AskUserQuestion` at 3.4a-iii that only
 * unprompted posting needs the check, not reaction-outcome dispatch (a human's own reaction is a
 * response to the bot, not the bot acting unprompted, same distinction 2.7a's core-hours guard
 * already draws for DM replies); the **ambient** Mid-band confirming-question post is unprompted in
 * exactly that same sense, so it needs this gate too. BUILD_PLAN 3.7's DM-triggered draft and
 * confirming question sit on the other side of that line and call neither guard in this file — they
 * go straight to the ungated `postAndPersistDraft`/`postAndPersistConfirmingQuestion` primitives,
 * checking only the cost cap. **Fails CLOSED** on any gate failure (an API error,
 * not just `appropriate: false`) — see `evaluateSituationalAppropriateness`'s own TSDoc for why
 * this is the opposite of `checkCostCapAndAlert`'s fail-open design.
 *
 * **Renamed from `isSituationallyAppropriate` at BUILD_PLAN 3.10**, when the return widened from a
 * bare `boolean` to the decision above, for the identical `docs/CONVENTIONS.md` reason
 * `evaluateCostAndRhythmGuard`'s own TSDoc documents for its 3.9 rename.
 */
export async function evaluateSituationalAppropriatenessGuard(
  deps: HandlerDeps,
  input: StandingProactiveGuardInput,
): Promise<SituationalAppropriatenessGuardDecision> {
  const { message, now, actionDescription } = input;
  const appropriateness = await evaluateSituationalAppropriateness(
    deps.anthropicClient,
    { text: message.text },
  );
  if (!appropriateness.ok) {
    // "skipping", not "deferring", for the same BUILD_PLAN 3.9 reason as the rhythm branch above:
    // the caller returns and the message is dropped unless the caller writes a review-queue row
    // off this reason. BUILD_PLAN 3.10 makes the ambient callers do exactly that — this branch was
    // a genuine remaining silent loss until now.
    deps.logger.error(
      `failed to evaluate situational appropriateness — skipping ${actionDescription} (fail-closed)`,
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        errorMessage: appropriateness.error.message,
      },
    );
    return { satisfied: false, reason: 'evaluation-failed' };
  }

  await recordUsageLogged(
    deps,
    {
      usage: appropriateness.usage,
      costUsdMicros: haikuCostUsdMicros(appropriateness.usage),
    },
    now,
  );

  if (!appropriateness.appropriate) {
    deps.logger.info(
      `skipping ${actionDescription} — situationally inappropriate`,
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        reasoning: appropriateness.reasoning,
      },
    );
    return { satisfied: false, reason: 'inappropriate' };
  }

  return { satisfied: true, reason: 'satisfied' };
}
