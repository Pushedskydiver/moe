import type { HandlerDeps } from './handle-inbound-message.js';
import type {
  DraftOrigin,
  PendingTicketDraft,
  QuestionSourceSurface,
} from '@moe/core';
import type { InboundMessage } from '@moe/slack';

import { composeTicketDraft, sonnetCostUsdMicros } from '@moe/agents';
import {
  classifyConfidenceBand,
  isAmbientIntakeListener,
  isSurfaceInScope,
} from '@moe/core';
import { addReaction, postMessage } from '@moe/slack';

import { classifyMessageForIntake } from './classify-message-for-intake.js';
import { composeAndPostConfirmingQuestion } from './compose-and-post-confirming-question.js';
import { logAmbientIntakeToReviewQueue } from './log-ambient-intake-to-review-queue.js';
import { recordUsageLogged } from './record-usage-logged.js';
import { repositoryErrorMessage } from './repository-error.js';
import {
  evaluateCostAndRhythmGuard,
  evaluateSituationalAppropriatenessGuard,
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
// at the exact sub-step that failed, below; same no-detail shape as `generate-and-post-reply.ts`'s
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
// `getDraftOutcomeCounts` filters to `'high-band'` only — a Mid-band-confirmed draft has already
// passed a human-confirmation gate before drafting even happens, and a `'high-band-dm'` draft
// (BUILD_PLAN 3.7) comes from a surface VISION §5.3 settles as already unambiguous, so neither is
// the ambient-classifier calibration signal VISION §5.4 names.
type PostAndPersistDraftOptions = {
  readonly now: Date;
  readonly origin: DraftOrigin;
  // Which VISION §5.2 surface triggered this draft, and therefore where it is posted (BUILD_PLAN
  // 3.7, Alex's own decision). An ambient draft is threaded on its source message, so it stays
  // attached to the conversation it came from in a busy channel. A DM draft is posted **top-level**
  // instead: threading it would leave the DM showing only the user's own message plus a "1 reply"
  // affordance, hiding both the draft and the 📦/🔁/✅ legend behind a click — on the one surface
  // whose defining property is that it is never silent, and where the reaction gate only works if
  // it is actually seen. Required rather than optional so no call site can silently inherit the
  // wrong placement by forgetting it.
  readonly surface: QuestionSourceSurface;
};

// Extracted purely to keep `postAndPersistDraft` under eslint's `max-lines-per-function` —
// composition code extracts aggressively (`docs/CONVENTIONS.md` §Code Style). Returns `undefined`
// on failure, already logged, matching `composeDraftContent`'s own precedent one call up. Claims
// the draft's "parent-message state" (`pending_ticket_drafts`) *before* posting to Slack, keyed on
// the source message's own ts (BUILD_PLAN 5.2b) — see `postAndPersistDraft`'s own comment below for
// the full claim-first reasoning.
async function claimDraft(
  deps: DraftPostingDeps,
  input: {
    readonly message: DraftSourceMessage;
    readonly drafted: DraftContent;
    readonly origin: DraftOrigin;
  },
): Promise<PendingTicketDraft | undefined> {
  const { message, drafted, origin } = input;
  const claimed = await deps.draftStore.create({
    personaId: deps.personaId,
    channelId: message.channelId,
    sourceMessageTs: message.ts,
    sourceMessageText: message.text,
    draftTitle: drafted.title,
    draftBody: drafted.body,
    origin,
  });
  if (!claimed.ok) {
    deps.logger.error('failed to claim pending ticket draft', {
      errorMessage: repositoryErrorMessage(claimed.error),
    });
    return undefined;
  }
  return claimed.draft;
}

// Extracted for the same `max-lines-per-function` reason as `claimDraft` above. Definitive
// failure — nothing was posted, so the claim is released rather than left orphaned (DA review,
// BUILD_PLAN 5.2b): an orphan here would silently pollute `getDraftOutcomeCounts`'s `'ignored'`
// bucket with a draft that was never actually posted.
async function releaseDraftClaimAfterPostFailure(
  deps: DraftPostingDeps,
  claimedId: string,
): Promise<void> {
  const released = await deps.draftStore.releaseClaim(claimedId);
  if (!released.ok) {
    deps.logger.error('failed to release pending ticket draft claim', {
      errorMessage: String(released.error.cause),
    });
  }
}

// Extracted for the same `max-lines-per-function` reason as `claimDraft` above. Returns `true` on
// success so the caller can short-circuit without needing the marked draft itself back.
async function markDraftPosted(
  deps: DraftPostingDeps,
  claimedId: string,
  messageTs: string,
): Promise<boolean> {
  const marked = await deps.draftStore.markPosted(claimedId, messageTs);
  if (marked.ok) return true;
  deps.logger.error('failed to mark pending ticket draft posted', {
    errorMessage:
      marked.error.kind === 'unavailable'
        ? 'draft was already marked posted, or no longer exists'
        : repositoryErrorMessage(marked.error),
  });
  return false;
}

// Claims the draft's "parent-message state" (`pending_ticket_drafts`) *before* posting to Slack,
// keyed on the source message's own ts, then posts against the source message — in-thread for an
// ambient draft, top-level for a DM one (see `surface` above) — fills in the real posted message's
// ts on the claimed row, and seeds the 📦/🔁/✅ reaction-gate legend onto it. BUILD_PLAN 5.2b's
// claim-first ordering (defence-in-depth for 5.2a's single-listener fix): the old order posted
// first and persisted second, so `UNIQUE (channel_id, message_ts)` — keyed on a value that doesn't
// exist until *after* the post — could never actually arbitrate a race between two processes
// racing the same source message. Claiming on `UNIQUE (channel_id, source_message_ts)` first makes
// a duplicate post structurally impossible rather than resting entirely on 5.2a's single-listener
// designation being correct. A claim whose Slack post then fails with a definitive error is
// released (`releaseDraftClaimAfterPostFailure` above), not left orphaned — an orphan there would
// silently pollute `getDraftOutcomeCounts`'s `'ignored'` bucket with a draft that was never posted
// (DA review, BUILD_PLAN 5.2b). Only a failure of the later mark-posted step still orphans
// (`messageTs` stays `null` forever, unretried) — the same accepted trade-off as
// `createGithubIssue`'s own claim-first idempotency guard for its own ambiguous-failure case
// (BUILD_PLAN 4.4b): a real Slack message exists by then, so deleting the tracking row would make
// it strictly worse, not better. This function itself runs no guard checks of its own — it's the
// caller's job to gate it first. `composeAndPostDraft` below (the ambient High-band caller) only
// reaches it after both `evaluateCostAndRhythmGuard` and `evaluateSituationalAppropriatenessGuard`
// pass.
//
// Two other callers reuse this function directly rather than reimplementing it, and both
// deliberately run **neither** guard first, because both are reactive rather than unprompted — the
// same reactive/proactive distinction `standing-proactive-guards.ts`'s own TSDoc documents:
// `draftFromConfirmingQuestion` (BUILD_PLAN 3.4b-ii, `reaction-outcome-actions.ts`), posting a
// draft against a Mid-band confirming question's *original* source message, placed to match how
// that question itself was posted, and
// `runDmIntakeCascade` (BUILD_PLAN 3.7, `run-dm-intake-cascade.ts`), posting a draft for a
// High-band DM. Both still check the cost cap, since `composeTicketDraft` below is a real, billed
// call regardless of which caller reached it.
export async function postAndPersistDraft(
  deps: DraftPostingDeps,
  message: DraftSourceMessage,
  options: PostAndPersistDraftOptions,
): Promise<PostAndPersistDraftResult> {
  const drafted = await composeDraftContent(deps, message, options.now);
  if (drafted === undefined) return { ok: false };

  const claimed = await claimDraft(deps, {
    message,
    drafted,
    origin: options.origin,
  });
  if (claimed === undefined) return { ok: false };

  // Composed once and reused for both the Slack post and the `postedText` returned below, so the
  // persisted conversation turn can never drift from what the user actually saw — the same
  // compose-once discipline `generateAndPost` applies to `composeGatedReply`.
  const draftMessageText = formatDraftMessageText(drafted);
  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: draftMessageText,
    ...(options.surface === 'dm' ? {} : { threadTs: message.ts }),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post ticket draft', {
      errorMessage: posted.error.message,
    });
    await releaseDraftClaimAfterPostFailure(deps, claimed.id);
    return { ok: false };
  }

  const wasMarkedPosted = await markDraftPosted(deps, claimed.id, posted.ts);
  if (!wasMarkedPosted) return { ok: false };

  await seedReactionLegend(deps, {
    message,
    draftMessageTs: posted.ts,
    remaining: DRAFT_REACTION_LEGEND,
  });

  deps.logger.info('posted ticket draft', {
    personaId: deps.personaId,
    channelId: message.channelId,
    draftId: claimed.id,
    draftTitle: drafted.title,
    draftBody: drafted.body,
    origin: options.origin,
  });
  return { ok: true, postedText: draftMessageText };
}

// `message`/`now`/`classified` bundled into one input object rather than three bare params —
// `composeAndPostDraft` was at eslint's `max-params: 3` with `deps`/`message`/`now`, and BUILD_PLAN
// 3.9 needs `classified` at the write site. Mirrors `composeAndPostConfirmingQuestion`'s own
// `ComposeAndPostConfirmingQuestionInput` shape, so the two band handlers read alike at their call
// sites — not identically: that one also carries a `surface` field this one has no use for, since
// an ambient draft is always posted in-thread.
type ComposeAndPostDraftInput = {
  readonly message: InboundMessage;
  readonly now: Date;
  // Carried purely for the BUILD_PLAN 3.9 off-hours `review_queue` row — the draft itself is
  // composed from the message text, not the classifier's output. Same reason
  // `ComposeAndPostConfirmingQuestionInput` already carries it.
  readonly classified: {
    readonly confidence: number;
    readonly reasoning: string;
  };
};

/**
 * BUILD_PLAN 3.4a-i's High-band action, real end-to-end as of BUILD_PLAN 3.4a-iii: gated by a
 * fresh cost-cap check, the 2.7a operating-rhythm guard, and BUILD_PLAN 3.4a-iii's own
 * situational-appropriateness gate (`evaluateCostAndRhythmGuard`/
 * `evaluateSituationalAppropriatenessGuard`, `standing-proactive-guards.ts`), then composes,
 * posts, persists, and seeds the reaction-gate legend (`postAndPersistDraft`).
 *
 * **BUILD_PLAN 3.9 — the operating-rhythm branch no longer drops the message**, and **BUILD_PLAN
 * 3.10 — neither do the other two guard exits.** Every way this function can decline to post now
 * writes a `review_queue` row, with a reason-specific `outcomeReason` so the 3.5 sweep digest can
 * tell causes apart: `evaluateCostAndRhythmGuard` blocking (`'high-band-off-hours'` for the rhythm
 * guard, `'high-band-cost-cap'` for the cap) and `evaluateSituationalAppropriatenessGuard` failing
 * CLOSED on an infrastructure blip (`'high-band-appropriateness-check-failed'`). None of these is a
 * deferral: nothing picks any of them up later, and calling one that would repeat the exact false
 * promise BUILD_PLAN 3.9 was filed to remove.
 *
 * **One guard branch is deliberately still silent: a genuine `appropriate: false` verdict.** Alex
 * settled (`AskUserQuestion`, BUILD_PLAN 3.10, 2026-07-28) that this is a considered decision the
 * message should not be acted on, not silent data loss — logging it too would add queue noise for
 * a settled judgement call, not the genuine ambiguity the queue exists for. This is the one place
 * in the guard chain where "the action was blocked" does not by itself justify a row; the other two
 * guard blocks below have no such alternative reading, so they always write one.
 *
 * **The cost-and-rhythm branch below writes unconditionally, choosing only the label** — not the
 * `!== 'cost-cap-reached'` conditional-write BUILD_PLAN 3.9 used. That was deliberately fail-safe
 * for a hypothetical *third* blocking reason (DA review, 3.9): preserve the message by default
 * rather than silently dropping it for a reason nobody had written a branch for yet. Now that both
 * known reasons write a row, the only remaining question for a hypothetical third one is which
 * *label* it gets, not whether it's kept — a strictly smaller failure mode than data loss, so an
 * unconditional write with a two-way label choice is the safer shape, not a regression of 3.9's own
 * insurance.
 *
 * **`'outside-core-hours'` still covers all three of `evaluateOperatingRhythm`'s *blocking*
 * reasons** (its enum has a fourth, `'within-core-hours'`, which does not reach here) — including
 * `'bank-holiday'` and `'holiday-status-unknown'`, both of which are only reached *inside* the
 * clock window — so a `'high-band-off-hours'` row can be written at 10:00 on a Tuesday when the
 * GOV.UK bank-holidays API was unreachable at boot. That is correct rather than a mislabel: the
 * guard fails **closed**, meaning it treats an unknown holiday status as a rest day, and this row
 * records the guard's decision, not the calendar.
 *
 * **Why the row is written before the appropriateness gate has run**, making both guard-level
 * blocks marginally more permissive than the in-hours, under-cap case: the gate is a billed Haiku
 * call whose purpose is deciding whether it is *appropriate to post into a shared channel* (VISION
 * §9, whose own illustration is a public-channel misstep). Nothing is posted here, so the risk it
 * guards against does not exist, and paying for it to decide whether to write a private row Alex
 * alone reads would be spend for no protection. The §6.4/§14 operating-rhythm rules are likewise
 * untouched — this function writes through `reviewQueueStore` and `logger` only, never a Slack
 * client, so nothing reaches the workspace.
 */
async function composeAndPostDraft(
  deps: HandlerDeps,
  input: ComposeAndPostDraftInput,
): Promise<void> {
  const { message, now, classified } = input;
  const guardInput = {
    message,
    now,
    actionDescription: 'ticket-draft composition',
  };
  const guard = await evaluateCostAndRhythmGuard(deps, guardInput);
  if (!guard.satisfied) {
    await logAmbientIntakeToReviewQueue(deps, {
      message,
      classified,
      outcomeReason:
        guard.reason === 'cost-cap-reached'
          ? 'high-band-cost-cap'
          : 'high-band-off-hours',
    });
    return;
  }

  const appropriateness = await evaluateSituationalAppropriatenessGuard(
    deps,
    guardInput,
  );
  if (!appropriateness.satisfied) {
    // Unlike the cost-and-rhythm guard above, this one genuinely has two different right answers
    // depending on why it failed — see this function's own TSDoc. Only the infra-blip case writes
    // a row; a genuine inappropriate verdict stays silent.
    if (appropriateness.reason === 'evaluation-failed') {
      await logAmbientIntakeToReviewQueue(deps, {
        message,
        classified,
        outcomeReason: 'high-band-appropriateness-check-failed',
      });
    }
    return;
  }

  await postAndPersistDraft(deps, message, {
    now,
    origin: 'high-band',
    surface: 'channel',
  });
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
 * 3.4b-i); a Low-band score logs a real review-queue row (`logAmbientIntakeToReviewQueue`, BUILD_PLAN 3.4c).
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
  // BUILD_PLAN 5.2a — beside Stage 0, and before it, because this is the cheaper check and the
  // one that short-circuits seven of the eight processes receiving this same message (the predicate
  // itself is true for exactly one — the designated listener). Deliberately a
  // sibling of `isSurfaceInScope` rather than a new arm inside it: that function's `dm` arm
  // returns `true` unconditionally, and BUILD_PLAN 3.7's DM cascade depends on that, so folding a
  // persona check in there would silently kill DM intake for every non-Sarah persona.
  if (!isAmbientIntakeListener(deps.personaId)) return;

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
    await composeAndPostDraft(deps, { message, now, classified });
  } else if (band === 'mid') {
    await composeAndPostConfirmingQuestion(deps, {
      message,
      now,
      classified,
      surface: 'channel',
    });
  } else {
    await logAmbientIntakeToReviewQueue(deps, {
      message,
      classified,
      outcomeReason: 'low-confidence',
    });
  }
}
