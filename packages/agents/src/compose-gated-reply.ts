import type { GenerateReplyResult } from './generate-reply.js';
import type { StatusClaimCandidate } from '@moe/core';

import { composeStatus } from '@moe/core';

import {
  parseStatusClaimInput,
  STATUS_CLAIM_TOOL_NAME,
} from './status-claim-tool.js';

/** The text posted to Slack (and persisted to history) whenever a status claim lacks evidence. */
export const NOT_YET_VERIFIED_TEXT = 'Not yet verified.';

/**
 * The two evidence fields a real work-tool call would supply. Derived from `@moe/core`'s
 * `StatusClaimCandidate` rather than hand-written, so it can't silently drift from what
 * `composeStatus` actually accepts.
 */
export type GatedReplyEvidence = Pick<
  StatusClaimCandidate,
  'toolCallId' | 'toolOutputSnippet'
>;

/**
 * Runs any `report_status` tool call in `result` through the 1.4 gate (`@moe/core`'s
 * `composeStatus`, VISION §7.6). Returns `result.reply` unchanged when no status claim was made —
 * this is also the gap in this chunk's own enforcement: a status claim asserted directly in free
 * prose, with no `report_status` call at all, passes straight through here ungated. Closing that
 * fully means detecting a status assertion in arbitrary prose, which is Stage 5/6 territory
 * (persona prompting, independent verifiers), not this function's job — `placeholder-system-
 * prompt.ts` instructs the model not to do this, but nothing here mechanically enforces it.
 * When a status claim IS present, its text (and any accompanying prose in `result.reply`) is
 * discarded in favor of the composed outcome — VISION §7.6 requires status claims to come from
 * the typed object exclusively, so any free text alongside the tool call isn't a second,
 * independent claim to preserve. `now` is injected rather than read from the real clock directly
 * — `composeStatus` is a pure function that takes `timestamp` from its caller, and this function
 * follows the same pattern for the same reason: the real clock is touched only at the real call
 * site (`apps/server/src/handle-inbound-message.ts`), tests pass a fixed stub. `evidence`
 * defaults to `{}` — no Stage-2 call site has real work-tool evidence to supply yet (Stage 6
 * wires that in); the parameter exists so the `grounded` branch is exercisable by tests now,
 * without a second signature change later. If the model calls `report_status` more than once in
 * one turn, only the first call is composed — an edge case Stage 2 has no real trigger for.
 */
export function composeGatedReply(
  result: Extract<GenerateReplyResult, { readonly ok: true }>,
  now: () => string,
  evidence: GatedReplyEvidence = {},
): string {
  const statusCall = result.toolUses.find(
    (toolUse) => toolUse.name === STATUS_CLAIM_TOOL_NAME,
  );
  if (statusCall === undefined) return result.reply;

  const composed = composeStatus({
    claim: parseStatusClaimInput(statusCall.input),
    timestamp: now(),
    ...evidence,
  });

  return composed.kind === 'grounded'
    ? composed.claim.claim
    : NOT_YET_VERIFIED_TEXT;
}
