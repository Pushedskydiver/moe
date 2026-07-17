import type { PersonaId } from './persona-config.js';

/**
 * No-persona-context fallback — used only when a caller doesn't have a `personaId` to build
 * `buildPersonaSystemPrompt` with (in practice, only `generateReply`'s own default when `system`
 * isn't overridden; every real call site has a persona ID and always overrides it). Deliberately
 * generic, non-persona voice — the real persona character
 * (`packages/agents/src/personas/*\/prompt.md`) is Stage 5 behind the do-not-touch gate
 * (`CLAUDE.md` §Non-obvious constraints).
 */
export const PLACEHOLDER_SYSTEM_PROMPT =
  'You are a helpful assistant replying to a direct message on Slack. Reply concisely and ' +
  "clearly. You have no tools available yet — if the user asks for something you can't do, say " +
  'so plainly rather than guessing.';

/**
 * The real per-turn system prompt (BUILD_PLAN 2.4b) — names the given persona as the identity
 * being addressed in this Slack conversation, so the model doesn't deny/correct being called by
 * that name (a live-verification finding: the old fixed `PLACEHOLDER_SYSTEM_PROMPT` explicitly
 * denied being "Sarah," which reads as broken given the whole point of the persona team concept).
 * Still deliberately withholds actual character — voice, personality, backstory — since that's
 * Stage 5 behind the do-not-touch gate (`packages/agents/src/personas/*\/prompt.md`); this only
 * establishes the bare name, nothing more. Makes no claim about memory of past turns one way or
 * the other — whether prior context exists depends on what history the caller forwards
 * (`generate-reply.ts`'s `history` param), not a static claim baked into the prompt. Instructs the
 * model to route status claims through the `report_status` tool (`status-claim-tool.ts`, BUILD_PLAN
 * 2.5) rather than asserting them directly in prose — VISION §7.6 requires status claims to come
 * from a typed object, never free prose; a bare-prose claim still slips past this instruction
 * ungated — a known limitation of this chunk's own (prompt-level, not mechanical) enforcement,
 * not something VISION itself sanctions as accepted (`compose-gated-reply.ts`'s own TSDoc; VISION
 * §7.6 only names a different gap, misgrounded claims, as an accepted Tier 0/1 tradeoff).
 */
export function buildPersonaSystemPrompt(personaId: PersonaId): string {
  const displayName = personaId.charAt(0).toUpperCase() + personaId.slice(1);
  return (
    `You're ${displayName}, replying to a direct message on Slack as a teammate — that's your ` +
    "name in this context, no need to correct anyone who uses it. You don't have a defined " +
    'personality or voice yet, so keep responses helpful and matter-of-fact rather than ' +
    'performing a character. Reply concisely and clearly. You have no tools yet for actually ' +
    "doing work — if asked to do something you can't do, say so plainly rather than guessing or " +
    'claiming you have done it. If you want to tell the user that some work is done, in ' +
    'progress, or has some other definite status, call the report_status tool with that claim ' +
    'rather than stating it directly in your reply — the system decides how it actually gets ' +
    "phrased back based on whether there's real evidence behind it."
  );
}
