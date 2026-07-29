import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import { classifyConfidenceBand, isSurfaceInScope } from '@moe/core';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { classifyMessageForIntake } from './classify-message-for-intake.js';
import { postAndPersistConfirmingQuestion } from './compose-and-post-confirming-question.js';
import { postAndPersistDraft } from './handle-ambient-channel-message.js';

/**
 * `handled: true` means the cascade posted something to Slack in place of the conversational
 * reply, and `postedText` is exactly what reached the user — the caller persists it as the
 * assistant's `conversation_turns` row so the history matches the real transcript.
 *
 * `handled: false` means the caller **must** fall through to the normal conversational reply. It
 * covers every non-High/Mid outcome without distinguishing them, deliberately: a Low band, a
 * cost-cap halt, a classifier failure and a failed Slack post all mean the same thing to the
 * caller, and collapsing them into one shape is what makes the fall-through impossible to
 * get half-right. There is no third state.
 */
export type DmIntakeCascadeResult =
  | { readonly handled: true; readonly postedText: string }
  | { readonly handled: false };

const NOT_HANDLED: DmIntakeCascadeResult = { handled: false };

/**
 * BUILD_PLAN 3.7 — VISION §5.2's intake cascade, run over a DM. Closes the deferred half of
 * Stage 3's exit criterion: before this, `createInboundMessageHandler` branched every non-DM into
 * `handleAmbientChannelMessage` and returned, so a work-shaped DM produced no classification, no
 * band, no draft and no reaction gate.
 *
 * **The governing invariant, and the reason this returns a result instead of posting a reply
 * itself: the DM path is never silent.** It always produces something — a reply, `FALLBACK_TEXT`,
 * or `HALT_TEXT`. The ambient path is silent by construction: every guard and every failure there
 * returns without posting. Routing DMs through the ambient handler as-is would therefore import
 * four silences onto the only interaction surface working in production — a work-shaped DM
 * outside 08:30–17:00 Mon–Fri (or on a cold boot where the bank-holidays cache fails closed), a
 * failed classify, a fail-closed appropriateness gate, and a cost-cap halt would each produce
 * **nothing at all**, where today every one of them produces a reply. **Settled with Alex before
 * code: the cascade may only ever _add_ to the DM response, never remove it.** High/Mid replace
 * the chat reply only when everything succeeds; anything else falls through. That makes this
 * module strictly additive and structurally unable to regress the working surface.
 *
 * Band routing (settled with Alex, 2026-07-25, recorded in BUILD_PLAN 3.7): **High** → a ticket
 * draft with the 📦/🔁/✅ legend and no chat reply; **Mid** → a confirming question with the 👍/👎
 * legend and no chat reply; **Low** → the conversational reply exactly as before, and **no**
 * review-queue row — the queue exists so nothing is "silently eaten", and a DM that got a real
 * answer wasn't eaten, so logging every "thanks" would only bury the 3.5 sweep digest in chatter.
 *
 * **Guards deliberately not run here.** The 2.7a operating-rhythm guard and the 3.4a-iii
 * situational-appropriateness gate both exist to gate *unprompted* posting; a draft triggered by
 * Alex's own DM is reactive engagement in exactly the sense 2.7a already settled for DM replies,
 * and `reaction-outcome-actions.ts`'s `draftFromConfirmingQuestion` already sets the precedent of
 * calling `postAndPersistDraft` directly with neither guard. This module therefore calls the
 * ungated `postAndPersistDraft`/`postAndPersistConfirmingQuestion` primitives rather than their
 * guarded `composeAndPost*` wrappers — which also means it cannot accidentally acquire the
 * rhythm guard later, and leaves the live ambient path untouched. The **cost cap still applies**
 * (that is about spend, not rest) and is checked **twice**: once inside `classifyMessageForIntake`
 * before the billed Haiku classify, and again on the High band before the billed Sonnet
 * `composeTicketDraft` — the classify that routed there is itself billed and already recorded, so
 * spend can cross the cap inside a single turn (DA review, chunk 3.7; the ambient path re-checks at
 * the same point for the same reason). On either halt this returns `handled: false` and the
 * conversational path re-checks and posts its own visible `HALT_TEXT`, so a halted persona keeps
 * its visible signal rather than going mute.
 */
export async function runDmIntakeCascade(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<DmIntakeCascadeResult> {
  // Stage 0, with `{kind: 'dm'}` — **not** `{kind: 'channel'}`. `isSurfaceInScope` always passes a
  // DM (BUILD_PLAN 3.2, VISION §5.3: a DM to a named persona is already unambiguous), and this
  // call is what finally makes that `dm` arm live rather than dead code. Passing `{kind:
  // 'channel'}` here instead would test a `D…` id against `MOE_WORK_RELEVANT_CHANNEL_IDS`, which
  // no DM channel is ever in, and would silently drop *every* DM out of the cascade.
  if (!isSurfaceInScope({ kind: 'dm' }, deps.channelScopeConfig)) {
    return NOT_HANDLED;
  }

  const classified = await classifyMessageForIntake(deps, message, now);
  if (!classified.ok) return NOT_HANDLED;

  const band = classifyConfidenceBand(classified.confidence);
  if (band === 'low') return NOT_HANDLED;

  if (band === 'high') {
    // A **second** cap check, between the classify above and the Sonnet `composeTicketDraft`
    // below. Not redundant: the classify call that got us here was itself billed and has already
    // been recorded, so spend can cross the cap inside this very turn — the ambient path checks
    // again here for exactly that reason (`evaluateCostAndRhythmGuard`, pinned by its own
    // "cost cap is reached between the classify and compose calls" test), and
    // `draftFromConfirmingQuestion` runs the same check before reusing `postAndPersistDraft`.
    // Skipping the guarded `composeAndPostDraft` wrapper is deliberate for the *rhythm* and
    // *appropriateness* guards only; dropping the cap with them would be collateral, and
    // BUILD_PLAN 3.4a-i's own rule — every real, billed call site needs this from the start —
    // applies to a new billed call site regardless of which surface reached it.
    const capCheck = await checkCostCapAndAlert(deps, now);
    if (capCheck.halt) {
      deps.logger.info(
        'skipping DM ticket-draft composition — monthly cost cap reached',
        { personaId: deps.personaId, channelId: message.channelId },
      );
      // Falls through, so the conversational path posts its own visible `HALT_TEXT` — the invariant
      // holds through the halt rather than around it.
      return NOT_HANDLED;
    }

    // `origin: 'high-band-dm'`, not `'high-band'` — `getDraftOutcomeCounts` filters to
    // `'high-band'`, and VISION §5.4's ignored/rejected-draft rate measures the *ambient*
    // classifier's calibration. Reusing `'high-band'` would fold a systematically
    // higher-propensity population into that rate, structurally the same defect DA caught at 3.6
    // for the High/Mid split.
    const posted = await postAndPersistDraft(deps, message, {
      now,
      origin: 'high-band-dm',
      surface: 'dm',
    });
    return posted.ok
      ? { handled: true, postedText: posted.postedText }
      : NOT_HANDLED;
  }

  // No second cap check on the Mid band, deliberately: `postAndPersistConfirmingQuestion` posts a
  // fixed template string (BUILD_PLAN 3.4b-i — Alex chose a template over an LLM-composed question
  // precisely so it needs no billed call site), so there is no further spend to gate here.

  const posted = await postAndPersistConfirmingQuestion(deps, {
    message,
    now,
    classified,
    surface: 'dm',
  });
  return posted.ok
    ? { handled: true, postedText: posted.postedText }
    : NOT_HANDLED;
}
