import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import { classifyMessageConfidence, haikuCostUsdMicros } from '@moe/agents';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { recordUsageLogged } from './record-usage-logged.js';

// Not exported (knip) — nothing outside this file needs the bare shape now that
// `ClassifyForIntakeResult` is the public return type; only used here to compose it.
type IntakeClassification = {
  readonly confidence: number;
  readonly reasoning: string;
};

/**
 * A boolean-discriminated union, mirroring `standing-proactive-guards.ts`'s own
 * `CostAndRhythmGuardDecision`/`SituationalAppropriatenessGuardDecision` shape (BUILD_PLAN 3.10) —
 * the same `docs/CONVENTIONS.md` reasoning applies here: a decision derived from given inputs, not
 * an expected domain failure, and a discriminated union so `reason` actually narrows at the call
 * site rather than needing a second unchecked cast.
 *
 * **Renamed from a bare `IntakeClassification | undefined` at BUILD_PLAN 3.11**, when the two
 * failure causes needed to become distinguishable: `'cost-cap-reached'` still has nothing
 * classifier-derived to carry (the halt fires *before* the billed call), but
 * `'classification-failed'` now carries the real Anthropic error message, since BUILD_PLAN 3.11's
 * own fix needs it to persist an honest `review_queue` row.
 */
export type ClassifyForIntakeResult =
  | ({ readonly ok: true } & IntakeClassification)
  | { readonly ok: false; readonly reason: 'cost-cap-reached' }
  | {
      readonly ok: false;
      readonly reason: 'classification-failed';
      readonly errorMessage: string;
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
 * Returns `ok: false` on either a cost-cap halt or a classification failure — both already logged.
 * **What the caller does with a failure differs by surface, and that difference is the point:**
 * the ambient path returns silently on a cost-cap halt but now persists a `review_queue` row on a
 * classification failure (BUILD_PLAN 3.11, `log-ambient-intake-to-review-queue.ts`'s own
 * `logClassificationFailure`), whereas the DM path must fall through to its normal
 * conversational reply regardless of which reason fired — `DmIntakeCascadeResult`'s own TSDoc
 * states this is deliberate: "a Low band, a cost-cap halt, a classifier failure and a failed Slack
 * post all mean the same thing to the caller... There is no third state." BUILD_PLAN 3.7's
 * governing invariant is that the cascade may only ever *add* to the DM response, never remove it,
 * so an `ok: false` here must never become silence on a DM.
 */
export async function classifyMessageForIntake(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<ClassifyForIntakeResult> {
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info('skipping classification — monthly cost cap reached', {
      personaId: deps.personaId,
      channelId: message.channelId,
    });
    return { ok: false, reason: 'cost-cap-reached' };
  }

  const classified = await classifyMessageConfidence(deps.anthropicClient, {
    text: message.text,
  });
  if (!classified.ok) {
    deps.logger.error('failed to classify inbound message', {
      errorMessage: classified.error.message,
    });
    return {
      ok: false,
      reason: 'classification-failed',
      errorMessage: classified.error.message,
    };
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

  return {
    ok: true,
    confidence: classified.confidence,
    reasoning: classified.reasoning,
  };
}
