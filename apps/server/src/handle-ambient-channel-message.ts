import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import {
  classifyMessageConfidence,
  composeTicketDraft,
  evaluateSituationalAppropriateness,
  haikuCostUsdMicros,
  sonnetCostUsdMicros,
} from '@moe/agents';
import {
  classifyConfidenceBand,
  evaluateOperatingRhythm,
  isSurfaceInScope,
} from '@moe/core';
import { addReaction, postMessage } from '@moe/slack';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { recordUsageLogged } from './record-usage-logged.js';
import { repositoryErrorMessage } from './repository-error.js';

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

// Sequential, not parallel — Slack's own rate limits apply per-call, and there's no correctness
// reason for these three to race; a failure on one reaction is logged and the remaining ones are
// still attempted, rather than aborting the whole legend over one miss. A `for...of` loop, not
// `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans it outright) — the documented
// escape hatch for `functional/no-loop-statements` ("warn", "Disable for orchestration where
// loops are clearer") is exactly this: a scoped disable on genuinely sequential async work.
async function seedReactionLegend(
  deps: HandlerDeps,
  message: InboundMessage,
  draftMessageTs: string,
): Promise<void> {
  // eslint-disable-next-line functional/no-loop-statements
  for (const emoji of DRAFT_REACTION_LEGEND) {
    const added = await addReaction(deps.slackClient, {
      channelId: message.channelId,
      messageTs: draftMessageTs,
      reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
    });
    if (!added.ok) {
      deps.logger.error('failed to add reaction-gate legend reaction', {
        personaId: deps.personaId,
        channelId: message.channelId,
        reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
        message: added.error.message,
      });
    }
  }
}

// Cost-cap checked before the operating-rhythm guard, not after — DA review noted the reverse
// order would save a DB round-trip during the (majority of) off-hours wall-clock time, but this
// order lets the existing cost-cap-only tests below pin the cap without also needing to pin `now`
// into the core-hours window, since `checkCostCapAndAlert`'s halt short-circuits before
// `evaluateOperatingRhythm` ever runs. Extracted from `composeAndPostDraft` purely to stay under
// eslint's `max-lines-per-function` (`docs/CONVENTIONS.md` §Code Style).
async function isPreDraftGuardsSatisfied(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<boolean> {
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info(
      'skipping ticket-draft composition — monthly cost cap reached',
      { personaId: deps.personaId, channelId: message.channelId },
    );
    return false;
  }

  const rhythm = await evaluateOperatingRhythm(now, deps.bankHolidaysCache);
  if (!rhythm.withinCoreHours) {
    deps.logger.info(
      'deferring ticket-draft composition — outside core hours',
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        reason: rhythm.reason,
      },
    );
    return false;
  }

  return true;
}

// BUILD_PLAN 3.4a-iii's own situational-appropriateness gate (VISION §9), run before composing
// anything — Alex confirmed via `AskUserQuestion` that only this unprompted, standing-proactive
// draft-post needs the check, not the reaction-outcome dispatch (a human's own reaction is a
// response to the bot, not the bot acting unprompted, same distinction 2.7a's core-hours guard
// already draws for DM replies). **Fails CLOSED** on any gate failure (an API error, not just
// `appropriate: false`) — see `evaluateSituationalAppropriateness`'s own TSDoc for why this is the
// opposite of `checkCostCapAndAlert`'s fail-open design.
async function isSituationallyAppropriate(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<boolean> {
  const appropriateness = await evaluateSituationalAppropriateness(
    deps.anthropicClient,
    { text: message.text },
  );
  if (!appropriateness.ok) {
    deps.logger.error(
      'failed to evaluate situational appropriateness — deferring draft composition (fail-closed)',
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
      'skipping ticket-draft composition — situationally inappropriate',
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

  await seedReactionLegend(deps, message, posted.ts);

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
 * situational-appropriateness gate (`isPreDraftGuardsSatisfied`/`isSituationallyAppropriate` above), then
 * composes, posts, persists, and seeds the reaction-gate legend (`postAndPersistDraft`).
 */
async function composeAndPostDraft(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<void> {
  const guardsPassed = await isPreDraftGuardsSatisfied(deps, message, now);
  if (!guardsPassed) return;

  const gatePassed = await isSituationallyAppropriate(deps, message, now);
  if (!gatePassed) return;

  await postAndPersistDraft(deps, message, now);
}

/**
 * VISION §5.2's Stage 0 + Stage 1, run for every ambient channel/group message (never a DM — a DM
 * is already addressed, §5.3). Out-of-scope channels never reach the classifier at all (Stage 0,
 * BUILD_PLAN 3.2's `isSurfaceInScope`); an in-scope one gets a single classification call (Stage 1,
 * `docs/decisions/STAGE-1-CLASSIFIER.md`) and the score is logged. A High-band score (VISION
 * §5.2's Stage 2 routing, `docs/decisions/STAGE-1-CLASSIFIER.md`'s thresholds) additionally
 * composes and posts a real ticket draft (`composeAndPostDraft`, BUILD_PLAN 3.4a-i/3.4a-iii) —
 * Mid/Low bands are logged as a plain classification only, until 3.4b/3.4c wire their own actions.
 * No reply is posted either way; this replaces the old "chat back to every message" behavior for
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
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info('skipping classification — monthly cost cap reached', {
      personaId: deps.personaId,
      channelId: message.channelId,
    });
    return;
  }

  const classified = await classifyMessageConfidence(deps.anthropicClient, {
    text: message.text,
  });
  if (!classified.ok) {
    deps.logger.error('failed to classify inbound message', {
      message: classified.error.message,
    });
    return;
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

  if (classifyConfidenceBand(classified.confidence) === 'high') {
    await composeAndPostDraft(deps, message, now);
  }
}
