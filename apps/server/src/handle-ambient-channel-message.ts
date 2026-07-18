import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import {
  classifyMessageConfidence,
  composeTicketDraft,
  haikuCostUsdMicros,
  sonnetCostUsdMicros,
} from '@moe/agents';
import {
  classifyConfidenceBand,
  evaluateOperatingRhythm,
  isSurfaceInScope,
} from '@moe/core';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { recordUsageLogged } from './record-usage-logged.js';

// VISION §5.2's High-band reaction-gate legend (✅ commit the draft as a ticket; 🔁 redo —
// regenerate from the thread; 📦 park it to Backlog untriaged). BUILD_PLAN 3.4a-i's own scope
// keeps auto-posting in log-only mode until 3.4a-iii's situational-appropriateness gate exists in
// front of it (VISION §9 requires that gate before the *first* standing-proactive action) — this
// constant records the intended legend in the log now, so 3.4a-iii's real `reactions.add` calls
// have an already-established, already-tested contract to wire against.
const DRAFT_REACTION_LEGEND = ['📦', '🔁', '✅'] as const;

/**
 * BUILD_PLAN 3.4a-i's High-band action: composes a ticket draft from the classified message and
 * logs it — no real Slack post, no real reactions, per Alex's explicit confirmation that
 * auto-posting stays shadow/log-only until 3.4a-iii's situational-appropriateness gate exists
 * (VISION §9, same "shadow only" precedent as chunk 3.3 for the same class of risk — chunk 6.5a-i
 * later follows this same pattern too, per its own text). Gated by
 * its own fresh `checkCostCapAndAlert` call, not the classify step's already-stale result — the
 * classify call's own cost may itself be what crosses the cap, so this call needs to see the
 * post-classify total, not a total read before that cost was recorded. Also respects the 2.7a
 * operating-rhythm guard (`evaluateOperatingRhythm`) — 2.7a's own settled off-hours policy names
 * "intake drafts" specifically as deferring to the next core-hours window, unlike chunk 3.3's
 * classification step just above, which 2.7a's guard explicitly does not gate.
 */
async function composeAndLogDraft(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<void> {
  // Cost-cap checked before the operating-rhythm guard, not after — DA review noted the reverse
  // order would save a DB round-trip during the (majority of) off-hours wall-clock time, but this
  // order lets the existing cost-cap-only tests below pin the cap without also needing to pin
  // `now` into the core-hours window, since `checkCostCapAndAlert`'s halt short-circuits before
  // `evaluateOperatingRhythm` ever runs.
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info(
      'skipping ticket-draft composition — monthly cost cap reached',
      { personaId: deps.personaId, channelId: message.channelId },
    );
    return;
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
    return;
  }

  const drafted = await composeTicketDraft(deps.anthropicClient, {
    text: message.text,
  });
  if (!drafted.ok) {
    deps.logger.error('failed to compose ticket draft', {
      message: drafted.error.message,
    });
    return;
  }

  await recordUsageLogged(
    deps,
    {
      usage: drafted.usage,
      costUsdMicros: sonnetCostUsdMicros(drafted.usage, now),
    },
    now,
  );

  deps.logger.info('would post high-band ticket draft', {
    personaId: deps.personaId,
    channelId: message.channelId,
    draftTitle: drafted.title,
    draftBody: drafted.body,
    wouldPostReactions: DRAFT_REACTION_LEGEND,
  });
}

/**
 * VISION §5.2's Stage 0 + Stage 1, run for every ambient channel/group message (never a DM — a DM
 * is already addressed, §5.3). Out-of-scope channels never reach the classifier at all (Stage 0,
 * BUILD_PLAN 3.2's `isSurfaceInScope`); an in-scope one gets a single classification call (Stage 1,
 * `docs/decisions/STAGE-1-CLASSIFIER.md`) and the score is logged. A High-band score (VISION
 * §5.2's Stage 2 routing, `docs/decisions/STAGE-1-CLASSIFIER.md`'s thresholds) additionally
 * composes and logs a ticket draft (`composeAndLogDraft`, BUILD_PLAN 3.4a-i) — Mid/Low bands are
 * logged as a plain classification only, until 3.4b/3.4c wire their own actions. No reply is
 * posted either way; this replaces the old "chat back to every message" behavior for ambient
 * surfaces (BUILD_PLAN 3.3's own DMs-only decision) — a DM still gets the full conversational
 * reply path, unchanged (`handle-inbound-message.ts`).
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
    await composeAndLogDraft(deps, message, now);
  }
}
