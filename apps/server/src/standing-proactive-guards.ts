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
 * Cost-cap-then-operating-rhythm guard shared by every standing-proactive Slack post. Cost-cap
 * checked before the operating-rhythm guard, not after — DA review (chunk 3.4a-iii) noted the
 * reverse order would save a DB round-trip during the (majority of) off-hours wall-clock time, but
 * this order lets cost-cap-only tests pin the cap without also needing to pin `now` into the
 * core-hours window, since `checkCostCapAndAlert`'s halt short-circuits before
 * `evaluateOperatingRhythm` ever runs.
 */
export async function isCostAndRhythmGuardSatisfied(
  deps: HandlerDeps,
  input: StandingProactiveGuardInput,
): Promise<boolean> {
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
    return false;
  }

  const rhythm = await evaluateOperatingRhythm(now, deps.bankHolidaysCache);
  if (!rhythm.withinCoreHours) {
    deps.logger.info(`deferring ${actionDescription} — outside core hours`, {
      personaId: deps.personaId,
      channelId: message.channelId,
      reason: rhythm.reason,
    });
    return false;
  }

  return true;
}

/**
 * BUILD_PLAN 3.4a-iii's own situational-appropriateness gate (VISION §9), run before any
 * standing-proactive Slack post — Alex confirmed via `AskUserQuestion` at 3.4a-iii that only
 * unprompted posting needs the check, not reaction-outcome dispatch (a human's own reaction is a
 * response to the bot, not the bot acting unprompted, same distinction 2.7a's core-hours guard
 * already draws for DM replies); the Mid-band confirming-question post is unprompted in exactly
 * that same sense, so it needs this gate too. **Fails CLOSED** on any gate failure (an API error,
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
    deps.logger.error(
      `failed to evaluate situational appropriateness — deferring ${actionDescription} (fail-closed)`,
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        message: appropriateness.error.message,
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
