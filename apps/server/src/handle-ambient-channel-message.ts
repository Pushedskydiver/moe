import type { HandlerDeps } from './handle-inbound-message.js';
import type { DraftOrigin } from '@moe/core';
import type { InboundMessage } from '@moe/slack';

import { composeTicketDraft, sonnetCostUsdMicros } from '@moe/agents';
import { classifyConfidenceBand, isSurfaceInScope } from '@moe/core';
import { addReaction, postMessage } from '@moe/slack';

import { classifyMessageForIntake } from './classify-message-for-intake.js';
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

// Only what `composeDraftContent`/`postAndPersistDraft`/`seedReactionLegend` actually read off a
// message — not the full `InboundMessage`, which carries `channelType`/`userId` fields a
// reaction-outcome context (BUILD_PLAN 3.4b-ii's "yes" answer, `reaction-outcome-actions.ts`) has
// no equivalent of: a `PendingConfirmingQuestion` row tracks who *reacted*, not who sent the
// *original* source message. `InboundMessage` already satisfies this structurally, so
// `handleAmbientChannelMessage`'s own real-message call sites below need no change.
export type DraftSourceMessage = {
  readonly channelId: string;
  readonly ts: string;
  readonly text: string;
};

// Only what `composeDraftContent`/`postAndPersistDraft`/`seedReactionLegend` actually use — not
// the full `HandlerDeps`, so a caller outside the ambient-message path (BUILD_PLAN 3.4b-ii's "yes"
// reaction-outcome) can reuse `postAndPersistDraft` without also needing to supply
// `historyStore`/`threadQueue`/`channelScopeConfig`/etc., which it has no use for. Same "only
// require what's actually used" reasoning as `check-cost-cap.ts`'s own `CostCapDeps`.
export type DraftPostingDeps = Omit<
  Pick<
    HandlerDeps,
    | 'anthropicClient'
    | 'logger'
    | 'costStore'
    | 'personaId'
    | 'slackClient'
    | 'draftStore'
  >,
  'anthropicClient'
> & { readonly anthropicClient: Parameters<typeof composeTicketDraft>[0] };

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
  readonly message: DraftSourceMessage;
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
  deps: DraftPostingDeps,
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
      errorMessage: added.error.message,
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
  deps: DraftPostingDeps,
  message: DraftSourceMessage,
  now: Date,
): Promise<DraftContent | undefined> {
  const drafted = await composeTicketDraft(deps.anthropicClient, {
    text: message.text,
  });
  if (!drafted.ok) {
    deps.logger.error('failed to compose ticket draft', {
      errorMessage: drafted.error.message,
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

// The claim-then-act fallback fix's own success signal — `draftFromConfirmingQuestion`
// (`reaction-outcome-actions.ts`) needs to know whether this succeeded so it can write a
// `review_queue` fallback row on failure; `composeAndPostDraft` below (the other caller) has no
// claim to fall back from, so it keeps ignoring the return value, same as `postMessage`'s own
// `ts`-on-success field being added at BUILD_PLAN 3.4a-iii without its other call sites needing to
// change. No `error` detail on the `false` branch — the specific failure reason is already logged
// at the exact sub-step that failed, below; same no-detail shape as `handle-inbound-message.ts`'s
// own `GenerateAndPostResult`.
//
// `postedText` (BUILD_PLAN 3.7) carries the exact text that reached Slack back to the DM cascade
// (`run-dm-intake-cascade.ts`), which persists it as the assistant's `conversation_turns` row —
// `handleThreadedMessage` is the only other writer of that table, and a DM answered with a draft
// instead of a chat reply would otherwise leave a hole in the history the *next* reply is generated
// from. Same "history should match the real transcript, not silently diverge from it" reasoning
// `generateAndPost` already applies to `HALT_TEXT`. Returned unconditionally rather than only for
// the DM caller, so the two can't drift: it is the same string that was posted, by construction.
type PostAndPersistDraftResult =
  { readonly ok: true; readonly postedText: string } | { readonly ok: false };

// `now`/`origin` bundled into one options object rather than two more bare params — already at
// eslint's `max-params: 3` ceiling with `deps`/`message`, same bundling reasoning
// `StartSlackListenerDeps` itself already documents elsewhere in this codebase. `origin`
// (BUILD_PLAN 3.6, `@moe/core`'s `DraftOrigin`) records which Stage 2 band produced this draft —
// `getDraftOutcomeCounts` filters to `'high-band'` only, since a Mid-band-confirmed draft has
// already passed a human-confirmation gate before drafting even happens, so it isn't the same
// classifier-calibration signal VISION §5.4 names.
type PostAndPersistDraftOptions = {
  readonly now: Date;
  readonly origin: DraftOrigin;
};

// Posts the composed draft in-thread on the source message, persists the "parent-message state"
// (`pending_ticket_drafts`) keyed on the real posted message, and seeds the 📦/🔁/✅ reaction-gate
// legend onto it — the real-posting half of BUILD_PLAN 3.4a-iii. This function itself runs no
// guard checks of its own — it's the caller's job to gate it first. `composeAndPostDraft` below
// (the High-band caller) only reaches it after both `isCostAndRhythmGuardSatisfied` and
// `isSituationallyAppropriate` pass. `draftFromConfirmingQuestion` (BUILD_PLAN 3.4b-ii,
// `reaction-outcome-actions.ts`, reusing this function directly rather than reimplementing it, to
// post a real ticket draft threaded on a Mid-band confirming question's *original* source message)
// deliberately does **not** run either guard first — a reaction-outcome dispatch is a response to
// the human, not the bot acting unprompted, the same reactive/proactive distinction
// `standing-proactive-guards.ts`'s own TSDoc documents — it only checks the cost cap, since
// `composeTicketDraft` below is still a real, billed call regardless of which caller reached it.
export async function postAndPersistDraft(
  deps: DraftPostingDeps,
  message: DraftSourceMessage,
  options: PostAndPersistDraftOptions,
): Promise<PostAndPersistDraftResult> {
  const drafted = await composeDraftContent(deps, message, options.now);
  if (drafted === undefined) return { ok: false };

  // Composed once and reused for both the Slack post and the `postedText` returned below, so the
  // persisted conversation turn can never drift from what the user actually saw — the same
  // compose-once discipline `generateAndPost` applies to `composeGatedReply`.
  const draftMessageText = formatDraftMessageText(drafted);
  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: draftMessageText,
    threadTs: message.ts,
  });
  if (!posted.ok) {
    deps.logger.error('failed to post ticket draft', {
      errorMessage: posted.error.message,
    });
    return { ok: false };
  }

  const created = await deps.draftStore.create({
    personaId: deps.personaId,
    channelId: message.channelId,
    messageTs: posted.ts,
    sourceMessageText: message.text,
    draftTitle: drafted.title,
    draftBody: drafted.body,
    origin: options.origin,
  });
  if (!created.ok) {
    deps.logger.error('failed to persist pending ticket draft', {
      errorMessage: repositoryErrorMessage(created.error),
    });
    return { ok: false };
  }

  await seedReactionLegend(deps, {
    message,
    draftMessageTs: posted.ts,
    remaining: DRAFT_REACTION_LEGEND,
  });

  deps.logger.info('posted ticket draft', {
    personaId: deps.personaId,
    channelId: message.channelId,
    draftId: created.draft.id,
    draftTitle: drafted.title,
    draftBody: drafted.body,
    origin: options.origin,
  });
  return { ok: true, postedText: draftMessageText };
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

  await postAndPersistDraft(deps, message, { now, origin: 'high-band' });
}

// VISION §5.2's "nothing is silently eaten" backstop (BUILD_PLAN 3.4c) — persists a Low-band
// message as a plain review-queue log row (`docs/VISION.md` §5.2, `@moe/core`'s
// `createReviewQueueEntry`) rather than dropping it, for BUILD_PLAN 3.5's own `review-queue-sweep`
// script to list. `outcomeReason: 'low-confidence'` — the only value this call site ever writes;
// BUILD_PLAN 3.4b-ii's own `logConfirmingQuestionAsNo` (`reaction-outcome-actions.ts`) writes
// `'mid-no'` through the same repository, 3.5's own `logStaleQuestionsAsSilent`
// (`review-queue-sweep.ts`) writes `'mid-silence'`, and the claim-then-act fallback fix's own
// `draftFromConfirmingQuestion` writes `'mid-yes-failed'` when a 👍 answer's own downstream draft
// composition/posting/persistence fails. `0009_widen_review_queue_outcome_reason.sql` (3.4b-ii)
// added `'mid-no'`/`'mid-silence'` in place of chunk 3.4c's original single placeholder,
// `'mid-no-response'`; `0011_widen_review_queue_outcome_reason_again.sql` added `'mid-yes-failed'`
// additively on top. "Log, don't throw" on
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
      errorMessage: repositoryErrorMessage(created.error),
    });
  }
}

/**
 * VISION §5.2's Stage 0 + Stage 1 for an **ambient** channel/group message — the surface nobody
 * addressed directly. A DM runs the same two stages through its own entry point instead
 * (`run-dm-intake-cascade.ts`, BUILD_PLAN 3.7); see below for why the two are separate functions
 * rather than one with a flag.
 *
 * Out-of-scope channels never reach the classifier at all (Stage 0, BUILD_PLAN 3.2's
 * `isSurfaceInScope`); an in-scope one gets a single classification call (Stage 1,
 * `docs/decisions/STAGE-1-CLASSIFIER.md`) and the score is logged. A High-band score (VISION
 * §5.2's Stage 2 routing, `docs/decisions/STAGE-1-CLASSIFIER.md`'s thresholds) additionally
 * composes and posts a real ticket draft (`composeAndPostDraft`, BUILD_PLAN 3.4a-i/3.4a-iii); a
 * Mid-band score posts a real confirming question (`composeAndPostConfirmingQuestion`, BUILD_PLAN
 * 3.4b-i); a Low-band score logs a real review-queue row (`logToReviewQueue`, BUILD_PLAN 3.4c).
 * This replaced the old "chat back to every message" behavior for ambient surfaces (BUILD_PLAN
 * 3.3's own DMs-only *chat* decision) — a DM never reaches this function.
 *
 * **This path is silent by construction, and the DM path is never silent — that asymmetry is the
 * reason they are separate.** Here, every guard block and every failure returns without posting
 * anything, because there is no reply for a draft to replace: an ambient message nobody addressed
 * expects no answer. On a DM there always is one, so BUILD_PLAN 3.7's invariant requires the
 * cascade to fall back to it rather than return. Two functions, so neither behaviour can be
 * reached by accident from the other's surface. This one additionally runs the operating-rhythm
 * guard and the situational-appropriateness gate (`standing-proactive-guards.ts`), which a
 * DM-triggered post deliberately does not — posting unprompted into a shared channel is exactly
 * what those two exist to gate.
 *
 * A real, billed Anthropic call regardless of which model it's on — gated by the same
 * `checkCostCapAndAlert` the DM reply path uses (BUILD_PLAN 2.6b), not a separate or looser check,
 * since both call sites draw against the same per-persona monthly cap (DA review, chunk 3.3: this
 * path originally shipped completely uncapped and unaccounted-for). That shared cap check now
 * lives in `classifyMessageForIntake`, called by both surfaces, so the two cannot drift apart. A
 * halted persona skips classification entirely rather than posting anything — there's no reply
 * path here to carry a visible `HALT_TEXT`-style signal, so the skip is logged instead, for Alex's
 * own visibility.
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
  const classified = await classifyMessageForIntake(deps, message, now);
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
