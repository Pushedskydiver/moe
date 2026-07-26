import type { PersonaId } from '../persona-roster.js';

/**
 * The single persona that runs VISION §5.2's intake cascade over **ambient** channel/group
 * messages. Settled by VISION §5.3, quoted in full because this constant is the only place that
 * decision is encoded in code: "**Sarah is the canonical intake listener for shared/ambient
 * channels**, consistent with her PM/front-door role; she triages, then hands off internally to the
 * right persona."
 *
 * A constant rather than an env var (Alex settled this at BUILD_PLAN 5.2a): §5.3 makes this a
 * product fact, not a deployment knob. Eight independently-deployed Fly Apps each carrying their
 * own copy of an `MOE_INTAKE_PERSONA_ID` is eight chances for the value to drift, and the failure
 * mode of drift is silent — either two personas classify (the duplicate-post bug this chunk fixes)
 * or none do (ambient intake stops entirely, with nothing to notice it).
 *
 * **The one genuinely silent failure mode, since the type system covers the others.** A typo or a
 * roster rename is a compile error (`PersonaId` here, `Record<PersonaId, …>` on `PERSONA_ROSTER`).
 * What is *not* caught anywhere is naming a **valid** persona whose process is undeployed, or which
 * is not a member of the work channels: ambient intake then stops fleet-wide and nothing reports
 * it, because "no persona classified this" looks identical to "no message arrived". If this value
 * ever changes, verify the named persona is both deployed and in `MOE_WORK_RELEVANT_CHANNEL_IDS`.
 *
 * Exported alongside the predicate deliberately, despite having no consumer outside this module
 * today: it is the value a future @-mention branch (BUILD_PLAN 5.6) needs in order to say "this
 * channel message is not mine to classify, but it *is* addressed to me."
 */
export const AMBIENT_INTAKE_PERSONA_ID: PersonaId = 'sarah';

/**
 * BUILD_PLAN 5.2a — whether this persona should run the ambient intake cascade at all.
 *
 * **Why this exists.** Every persona is an independent process with its own Slack app (VISION
 * §4.5/§6.6), so each one receives the same channel message and, before this chunk, each one
 * independently classified it. With K personas in a work channel that meant K billed
 * classifications per message, and for a High-band message K billed draft compositions and **K
 * separately-committable ticket drafts** — each with its own working ✅/🔁/📦 legend, since
 * `pending_ticket_drafts`' `UNIQUE (channel_id, message_ts)` keys on the *posted* draft's own ts,
 * which differs per persona and therefore never collides. The duplicate is a real duplicate
 * ticket, not an inert message.
 *
 * **What this deliberately does NOT gate.** Only the ambient intake cascade. Not channel
 * membership, not the Socket Mode listener, and not any other reason a persona might post into a
 * work channel — VISION §6.5 has Nia posting EOD digests to `#moe-team` and §6.1 gives
 * `#moe-research` to Theo, and both require a non-intake persona to be present and posting there.
 * Gating membership or the listener instead would foreclose those. It also leaves room beside it
 * for a future @-mention branch (BUILD_PLAN 5.6's "addressed-only?" question), which must be able
 * to reach a named persona in a channel it is not the intake listener for.
 *
 * **Not applicable to DMs.** A DM is delivered only to the addressed persona's own app, so there
 * is no duplication to prevent and nothing to designate — `run-dm-intake-cascade.ts` (BUILD_PLAN
 * 3.7) does not consult this, and must not: doing so would silently kill DM intake for all seven
 * non-Sarah personas, which is the one regression this chunk could plausibly cause.
 */
export function isAmbientIntakeListener(personaId: PersonaId): boolean {
  return personaId === AMBIENT_INTAKE_PERSONA_ID;
}
