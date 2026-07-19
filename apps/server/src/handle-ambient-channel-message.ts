import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import {
  classifyMessageConfidence,
  composeTicketDraft,
  haikuCostUsdMicros,
  sonnetCostUsdMicros,
} from '@moe/agents';
import { classifyConfidenceBand, isSurfaceInScope } from '@moe/core';
import { addReaction, postMessage } from '@moe/slack';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { composeAndPostConfirmingQuestion } from './compose-and-post-confirming-question.js';
import { recordUsageLogged } from './record-usage-logged.js';
import { repositoryErrorMessage } from './repository-error.js';
import {
  isCostAndRhythmGuardSatisfied,
  isSituationallyAppropriate,
} from './standing-proactive-guards.js';

// VISION §5.2's High-band reaction-gate legend (✅ commit the draft as a ticket; 🔁 redo —
// regenerate from the thread; 📦 park it to Backlog untriaged). BUILD_PLAN 3.4a-iii wires these as
// real `reactions.add` calls, seeded in this order onto the real posted draft message.
const DRAFT_REACTION_LEGEND = ['📦', '🔁', '✅'] as const;
const REACTION_NAME_BY_LEGEND_EMOJI: Readonly<
  Record<(typeof DRAFT_REACTION_LEGEND)[number], string>
> = {
  '📦': 'package',
  '🔁': 'repeat',
  '✅': 'white_check_mark',
};

// Reused across `formatDraftMessageText`'s param and `composeDraftContent`'s return type below —
// named per `docs/CONVENTIONS.md`'s "reused types earn a named type" rule.
type DraftContent = {
  readonly title: string;
  readonly body: string;
};

function formatDraftMessageText(draft: DraftContent): string {
  return (
    `📋 *${draft.title}*\n${draft.body}\n\n` +
    'React ✅ to commit this as a ticket, 🔁 to redo it, or 📦 to park it to Backlog.'
  );
}

// `message`/`draftMessageTs` bundled with the recursion's own `remaining` state into one `input`
// object — `deps` plus 3 more positional params would cross eslint's `max-params: 3`, same
// reasoning `check-cost-cap.ts`'s own `sendCostAlerts` input bundling already documents.
type SeedReactionLegendInput = {
  readonly message: InboundMessage;
  readonly draftMessageTs: string;
  readonly remaining: readonly (typeof DRAFT_REACTION_LEGEND)[number][];
};

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — matches `check-cost-cap.ts`'s `sendCostAlerts` precedent for sequential-by-
// design async work over a short list. Sequential, not parallel: Slack's own rate limits apply
// per-call, and there's no correctness reason for these three to race; a failure on one reaction
// is logged and the remaining ones are still attempted, rather than aborting the whole legend
// over one miss.
async function seedReactionLegend(
  deps: HandlerDeps,
  input: SeedReactionLegendInput,
): Promise<void> {
  const [emoji, ...rest] = input.remaining;
  if (emoji === undefined) return;

  const added = await addReaction(deps.slackClient, {
    channelId: input.message.channelId,
    messageTs: input.draftMessageTs,
    reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
  });
  if (!added.ok) {
    deps.logger.error('failed to add reaction-gate legend reaction', {
      personaId: deps.personaId,
      channelId: input.message.channelId,
      reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
      message: added.error.message,
    });
  }

  await seedReactionLegend(deps, { ...input, remaining: rest });
}

// Both guard functions moved to `standing-proactive-guards.ts` (BUILD_PLAN 3.4b-i) once the
// Mid-band confirming-question post needed the exact same checks — see that file's own TSDoc.
// Extracted from `postAndPersistDraft` purely to stay under eslint's `max-lines-per-function`
// (`docs/CONVENTIONS.md` §Code Style) — composes the draft and records its own cost accounting,
// returning `undefined` on failure (already logged) so the caller can short-circuit.
async function composeDraftContent(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<DraftContent | undefined> {
  const drafted = await composeTicketDraft(deps.anthropicClient, {
    text: message.text,
  });
  if (!drafted.ok) {
    deps.logger.error('failed to compose ticket draft', {
      message: drafted.error.message,
    });
    return undefined;
  }

  await recordUsageLogged(
    deps,
    {
      usage: drafted.usage,
      costUsdMicros: sonnetCostUsdMicros(drafted.usage, now),
    },
    now,
  );

  return drafted;
}

// Posts the composed draft in-thread on the source message, persists the "parent-message state"
// (`pending_ticket_drafts`) keyed on the real posted message, and seeds the 📦/🔁/✅ reaction-gate
// legend onto it — the real-posting half of BUILD_PLAN 3.4a-iii, run only once both guards above
// have passed.
async function postAndPersistDraft(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<void> {
  const drafted = await composeDraftContent(deps, message, now);
  if (drafted === undefined) return;

  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: formatDraftMessageText(drafted),
    threadTs: message.ts,
  });
  if (!posted.ok) {
    deps.logger.error('failed to post ticket draft', {
      message: posted.error.message,
    });
    return;
  }

  const created = await deps.draftStore.create({
    personaId: deps.personaId,
    channelId: message.channelId,
    messageTs: posted.ts,
    sourceMessageText: message.text,
    draftTitle: drafted.title,
    draftBody: drafted.body,
  });
  if (!created.ok) {
    deps.logger.error('failed to persist pending ticket draft', {
      message: repositoryErrorMessage(created.error),
    });
    return;
  }

  await seedReactionLegend(deps, {
    message,
    draftMessageTs: posted.ts,
    remaining: DRAFT_REACTION_LEGEND,
  });

  deps.logger.info('posted high-band ticket draft', {
    personaId: deps.personaId,
    channelId: message.channelId,
    draftId: created.draft.id,
    draftTitle: drafted.title,
    draftBody: drafted.body,
  });
}

/**
 * BUILD_PLAN 3.4a-i's High-band action, real end-to-end as of BUILD_PLAN 3.4a-iii: gated by a
 * fresh cost-cap check, the 2.7a operating-rhythm guard, and BUILD_PLAN 3.4a-iii's own
 * situational-appropriateness gate (`isCostAndRhythmGuardSatisfied`/`isSituationallyAppropriate`,
 * `standing-proactive-guards.ts`), then composes, posts, persists, and seeds the reaction-gate
 * legend (`postAndPersistDraft`).
 */
async function composeAndPostDraft(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<void> {
  const guardInput = {
    message,
    now,
    actionDescription: 'ticket-draft composition',
  };
  const guardsPassed = await isCostAndRhythmGuardSatisfied(deps, guardInput);
  if (!guardsPassed) return;

  const gatePassed = await isSituationallyAppropriate(deps, guardInput);
  if (!gatePassed) return;

  await postAndPersistDraft(deps, message, now);
}

// VISION §5.2's "nothing is silently eaten" backstop (BUILD_PLAN 3.4c) — persists a Low-band
// message as a plain review-queue log row (`docs/VISION.md` §5.2, `@moe/core`'s
// `createReviewQueueEntry`) rather than dropping it, for BUILD_PLAN 3.5's own future sweep to
// list. `outcomeReason: 'low-confidence'` — the only value this call site ever writes; BUILD_PLAN
// 3.4b-ii's own future "no or silence" Mid-band outcome writes through the same repository once
// that chunk lands — with its own migration widening `outcomeReason`'s CHECK constraint from
// `'mid-no-response'` to the two distinct `'mid-no'`/`'mid-silence'` values 3.4b-ii's own text
// settles on, not an additive change to an already-single-value constraint. "Log, don't throw" on
// failure, same as `recordUsageLogged`'s
// own precedent — a review-queue write failing should never surface as a visible error, since
// there's no reply path here to carry one.
async function logToReviewQueue(
  deps: HandlerDeps,
  message: InboundMessage,
  classified: { readonly confidence: number; readonly reasoning: string },
): Promise<void> {
  const created = await deps.reviewQueueStore.create({
    personaId: deps.personaId,
    channelId: message.channelId,
    messageTs: message.ts,
    sourceMessageText: message.text,
    confidence: classified.confidence,
    reasoning: classified.reasoning,
    outcomeReason: 'low-confidence',
  });
  if (!created.ok) {
    deps.logger.error('failed to log low-confidence message to review queue', {
      personaId: deps.personaId,
      channelId: message.channelId,
      message: repositoryErrorMessage(created.error),
    });
  }
}

// Extracted from `handleAmbientChannelMessage` purely to stay under eslint's
// `max-lines-per-function` (`docs/CONVENTIONS.md` §Code Style) — the cap-check-then-classify-then-
// account-for-usage sequence, returning `undefined` on either a halt or a classification failure
// (both already logged) so the caller can short-circuit, same shape as `composeDraftContent` above.
async function classifyAmbientMessage(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<
  { readonly confidence: number; readonly reasoning: string } | undefined
> {
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
      message: classified.error.message,
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

/**
 * VISION §5.2's Stage 0 + Stage 1, run for every ambient channel/group message (never a DM — a DM
 * is already addressed, §5.3). Out-of-scope channels never reach the classifier at all (Stage 0,
 * BUILD_PLAN 3.2's `isSurfaceInScope`); an in-scope one gets a single classification call (Stage 1,
 * `docs/decisions/STAGE-1-CLASSIFIER.md`) and the score is logged. A High-band score (VISION
 * §5.2's Stage 2 routing, `docs/decisions/STAGE-1-CLASSIFIER.md`'s thresholds) additionally
 * composes and posts a real ticket draft (`composeAndPostDraft`, BUILD_PLAN 3.4a-i/3.4a-iii); a
 * Mid-band score posts a real confirming question (`composeAndPostConfirmingQuestion`, BUILD_PLAN
 * 3.4b-i); a Low-band score logs a real review-queue row (`logToReviewQueue`, BUILD_PLAN 3.4c).
 * This replaces the old "chat back to every message" behavior for
 * ambient surfaces (BUILD_PLAN 3.3's own DMs-only decision) — a DM still gets the full
 * conversational reply path, unchanged (`handle-inbound-message.ts`).
 *
 * A real, billed Anthropic call regardless of which model it's on — gated by the same
 * `checkCostCapAndAlert` the DM reply path uses (BUILD_PLAN 2.6b), not a separate or looser check,
 * since both call sites draw against the same per-persona monthly cap (DA review, chunk 3.3: this
 * path originally shipped completely uncapped and unaccounted-for). A halted persona skips
 * classification entirely rather than posting anything — there's no reply path here to carry a
 * visible `HALT_TEXT`-style signal, so the skip is logged instead, for Alex's own visibility.
 */
export async function handleAmbientChannelMessage(
  deps: HandlerDeps,
  message: InboundMessage,
): Promise<void> {
  const inScope = isSurfaceInScope(
    { kind: 'channel', channelId: message.channelId },
    deps.channelScopeConfig,
  );
  if (!inScope) return;

  const now = new Date();
  const classified = await classifyAmbientMessage(deps, message, now);
  if (classified === undefined) return;

  const band = classifyConfidenceBand(classified.confidence);
  if (band === 'high') {
    await composeAndPostDraft(deps, message, now);
  } else if (band === 'mid') {
    await composeAndPostConfirmingQuestion(deps, { message, now, classified });
  } else {
    await logToReviewQueue(deps, message, classified);
  }
}
