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
 * Why the guard blocked, or `'satisfied'` if it didn't. The two blocking reasons are deliberately
 * distinguishable (BUILD_PLAN 3.9): they mean different things and now have different consequences
 * — an off-hours block writes a `review_queue` row so the message survives, a cost-cap halt does
 * not. Before 3.9 both collapsed into a bare `false` and no caller could tell them apart, which is
 * precisely why the off-hours case could not be handled separately.
 */
type CostAndRhythmGuardReason =
  'satisfied' | 'cost-cap-reached' | 'outside-core-hours';

/**
 * A flat boolean-plus-reason object, mirroring `@moe/core`'s own
 * `OperatingRhythmDecision`/`WipLimitDecision` — the two existing `*Decision` types, which is where
 * this shape comes from. **`docs/CONVENTIONS.md` prescribes the `evaluate*` verb, not the return
 * shape**, and its `Result`-shaped-discriminated-union rule is explicitly scoped to "expected
 * domain failures" (a Slack/GitHub call failing, a validation failing) — a guard reporting a
 * decision is not one, which is why the flat shape is the right precedent to follow here rather
 * than `evaluateSituationalAppropriateness`'s `Result`. Both readings were checked against
 * `docs/CONVENTIONS.md` directly after two review passes disagreed about it.
 */
export type CostAndRhythmGuardDecision = {
  readonly satisfied: boolean;
  readonly reason: CostAndRhythmGuardReason;
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
    // genuine deferral is 3.9's own step (2), gated on chunk 7.2a or 6.1a-i building a timer.
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
 */
export async function isSituationallyAppropriate(
  deps: HandlerDeps,
  input: StandingProactiveGuardInput,
): Promise<boolean> {
  const { message, now, actionDescription } = input;
  const appropriateness = await evaluateSituationalAppropriateness(
    deps.anthropicClient,
    { text: message.text },
  );
  if (!appropriateness.ok) {
    // "skipping", not "deferring", for the same BUILD_PLAN 3.9 reason as the rhythm branch above:
    // the caller returns and the message is dropped, with nothing scheduled to retry it. This
    // branch is a genuine remaining silent loss — an Anthropic error or timeout drops an ambient
    // message permanently — and is deliberately out of 3.9's scope (Alex settled 2026-07-27, to
    // keep this chunk on the rhythm guard); BUILD_PLAN 3.10 carries it. Correcting the word is in
    // scope regardless, because leaving one "deferring" beside a corrected one is worse than
    // leaving both: it reads as a considered distinction rather than an oversight.
    deps.logger.error(
      `failed to evaluate situational appropriateness — skipping ${actionDescription} (fail-closed)`,
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        errorMessage: appropriateness.error.message,
      },
    );
    return false;
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
    return false;
  }

  return true;
}
