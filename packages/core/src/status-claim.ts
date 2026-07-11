import { z } from 'zod';

import { isNotBlank } from './is-not-blank.js';

const claimSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'claim must not be blank');
const toolCallIdSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'toolCallId must not be blank');
const toolOutputSnippetSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'toolOutputSnippet must not be blank');

/**
 * A persona's status claim about its own work (VISION §7.6), generated from this typed shape —
 * never free prose — so an ungrounded claim (no real tool call behind it) is a validation
 * failure the composer below catches, not a prompting problem. Also enforces basic input hygiene
 * on `claim` (non-blank) and `timestamp` (ISO-8601) — a step beyond VISION §7.6's own
 * evidence-presence framing, folded into the same gate rather than a separate check.
 */
export const statusClaimSchema = z.object({
  claim: claimSchema,
  toolCallId: toolCallIdSchema,
  toolOutputSnippet: toolOutputSnippetSchema,
  timestamp: z.iso.datetime(),
});

export type StatusClaim = z.infer<typeof statusClaimSchema>;

/**
 * The shape a caller assembles before grounding is checked — derived from `StatusClaim` rather
 * than hand-maintained, so it can't silently drift from what `statusClaimSchema` actually
 * validates. `toolCallId`/`toolOutputSnippet` are loosened to optional here specifically because a
 * persona might not have populated them yet; that gap is exactly what `composeStatus` gates on.
 */
export type StatusClaimCandidate = Omit<
  StatusClaim,
  'toolCallId' | 'toolOutputSnippet'
> & {
  readonly toolCallId?: string;
  readonly toolOutputSnippet?: string;
};

export type ComposedStatus =
  | { readonly kind: 'grounded'; readonly claim: StatusClaim }
  | { readonly kind: 'not-yet-verified' };

/**
 * Refuses to emit a status claim without populated `toolCallId`/`toolOutputSnippet` evidence,
 * falling back to `{ kind: 'not-yet-verified' }` instead (VISION §7.6) — this is failure-mode-#2's
 * fix: an ungrounded claim becomes a validation failure caught here, not a prompting problem left
 * to the model's own judgment. The same fallback also fires for a blank `claim` string or a
 * malformed `timestamp` — plain input hygiene collapsed into the same undifferentiated outcome,
 * not itself part of the anti-fabrication mechanism.
 */
export function composeStatus(candidate: StatusClaimCandidate): ComposedStatus {
  const parsed = statusClaimSchema.safeParse(candidate);
  return parsed.success
    ? { kind: 'grounded', claim: parsed.data }
    : { kind: 'not-yet-verified' };
}
