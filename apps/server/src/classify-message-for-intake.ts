import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import { classifyMessageConfidence, haikuCostUsdMicros } from '@moe/agents';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { recordUsageLogged } from './record-usage-logged.js';

export type IntakeClassification = {
  readonly confidence: number;
  readonly reasoning: string;
};

/**
 * VISION §5.2's Stage 1, shared verbatim by both surfaces that run it: the ambient channel/group
 * path (`handle-ambient-channel-message.ts`) and — as of BUILD_PLAN 3.7 — the DM path
 * (`run-dm-intake-cascade.ts`). Extracted from `handleAmbientChannelMessage`'s own private
 * `classifyAmbientMessage` once the DM cascade needed the identical sequence, the same genuine
 * 2+-consumer trigger that produced `standing-proactive-guards.ts` at BUILD_PLAN 3.4b-i — and for
 * a sharper reason here: this is a real, billed Anthropic call, and chunk 3.3's own DA review
 * caught exactly this call shipping uncapped. Two copies of a cap-check-then-bill sequence is two
 * places for that defect to reappear independently.
 *
 * Returns `undefined` on either a cost-cap halt or a classification failure — both already logged.
 * **What the caller does with `undefined` differs by surface, and that difference is the point:**
 * the ambient path returns silently (there is no reply path there to carry a visible signal),
 * whereas the DM path must fall through to its normal conversational reply, which re-checks the cap
 * itself and posts a visible `HALT_TEXT`/`FALLBACK_TEXT`. BUILD_PLAN 3.7's governing invariant is
 * that the cascade may only ever *add* to the DM response, never remove it, so a `undefined` here
 * must never become silence on a DM.
 */
export async function classifyMessageForIntake(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<IntakeClassification | undefined> {
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info('skipping classification — monthly cost cap reached', {
      personaId: deps.personaId,
      channelId: message.channelId,
    });
    return undefined;
  }

  const classified = await classifyMessageConfidence(deps.anthropicClient, {
    text: message.text,
  });
  if (!classified.ok) {
    deps.logger.error('failed to classify inbound message', {
      errorMessage: classified.error.message,
    });
    return undefined;
  }

  await recordUsageLogged(
    deps,
    {
      usage: classified.usage,
      costUsdMicros: haikuCostUsdMicros(classified.usage),
    },
    now,
  );

  deps.logger.info('classified inbound message', {
    personaId: deps.personaId,
    channelId: message.channelId,
    messageText: message.text,
    confidence: classified.confidence,
    reasoning: classified.reasoning,
  });

  return classified;
}
