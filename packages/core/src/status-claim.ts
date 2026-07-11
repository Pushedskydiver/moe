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
 * failure the composer below catches, not a prompting problem.
 */
export const statusClaimSchema = z.object({
  claim: claimSchema,
  toolCallId: toolCallIdSchema,
  toolOutputSnippet: toolOutputSnippetSchema,
  timestamp: z.iso.datetime(),
});

export type StatusClaim = z.infer<typeof statusClaimSchema>;

export type StatusClaimCandidate = {
  readonly claim: string;
  readonly toolCallId?: string;
  readonly toolOutputSnippet?: string;
  readonly timestamp: string;
};

export type ComposedStatus =
  | { readonly kind: 'grounded'; readonly claim: StatusClaim }
  | { readonly kind: 'not-yet-verified' };

/**
 * Refuses to emit a status claim without populated `toolCallId`/`toolOutputSnippet` evidence,
 * falling back to `{ kind: 'not-yet-verified' }` instead (VISION §7.6) — this is failure-mode-#2's
 * fix: an ungrounded claim becomes a validation failure caught here, not a prompting problem left
 * to the model's own judgment.
 */
export function composeStatus(candidate: StatusClaimCandidate): ComposedStatus {
  const parsed = statusClaimSchema.safeParse(candidate);
  return parsed.success
    ? { kind: 'grounded', claim: parsed.data }
    : { kind: 'not-yet-verified' };
}
