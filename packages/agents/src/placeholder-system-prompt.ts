import type { PersonaId } from './persona-config.js';
import type { Anthropic } from '@anthropic-ai/sdk';
import type { AppLogger } from '@moe/core';

import { buildCachedSystemBlocks } from './build-cached-system-blocks.js';
import { fetchPersonaPromptContent } from './fetch-persona-prompt-content.js';

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
 * Names the given persona as the identity being addressed in this Slack conversation, so the
 * model doesn't deny/correct being called by that name (a live-verification finding: the old
 * fixed `PLACEHOLDER_SYSTEM_PROMPT` explicitly denied being "Sarah," which reads as broken given
 * the whole point of the persona team concept). Makes no claim about memory of past turns one way
 * or the other — whether prior context exists depends on what history the caller forwards
 * (`generate-reply.ts`'s `history` param), not a static claim baked into the prompt. Instructs the
 * model to route status claims through the `report_status` tool (`status-claim-tool.ts`, BUILD_PLAN
 * 2.5) rather than asserting them directly in prose — VISION §7.6 requires status claims to come
 * from a typed object, never free prose; a bare-prose claim still slips past this instruction
 * ungated — a known limitation of this chunk's own (prompt-level, not mechanical) enforcement,
 * not something VISION itself sanctions as accepted (`compose-gated-reply.ts`'s own TSDoc; VISION
 * §7.6 only names a different gap, misgrounded claims, as an accepted Tier 0/1 tradeoff). Used as
 * the fallback for any persona without a real `prompt.md` yet (below).
 */
function buildGenericTemplate(personaId: PersonaId): string {
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

/**
 * The real per-turn system prompt (BUILD_PLAN 2.4b), now wired to each persona's own real
 * `prompt.md` when one exists (BUILD_PLAN 5.3a-ii) — once real content exists it *is* the entire
 * system prompt, nothing appended on top: Sarah's own file already covers what
 * `buildGenericTemplate` exists to convey (e.g. its "Reasoning discipline" section already
 * instructs the `report_status`-tool-routing behavior above), so layering the two would be
 * redundant, not additive. Still falls back to `buildGenericTemplate`, unchanged from before this
 * chunk, for the 7 personas without a `prompt.md` yet — each one's own 5.3 sub-chunk lights this
 * up automatically the day its `prompt.md` merges, no further wiring needed. Wraps the result via
 * `buildCachedSystemBlocks` (BUILD_PLAN 5.3a-ii) so the (potentially large, always static per
 * persona) content is eligible for Anthropic prompt caching. `logger`, when given, is forwarded
 * to `fetchPersonaPromptContent` so a real read failure (not just an undrafted persona) is
 * observable rather than silently degrading to the generic template (DA review, BUILD_PLAN
 * 5.3a-ii PR 1).
 */
export async function buildPersonaSystemPrompt(
  personaId: PersonaId,
  logger?: AppLogger,
): Promise<readonly Anthropic.TextBlockParam[]> {
  const content =
    (await fetchPersonaPromptContent(personaId, logger)) ??
    buildGenericTemplate(personaId);
  return buildCachedSystemBlocks([content]);
}
