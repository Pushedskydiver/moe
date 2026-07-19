import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * The Mid-band "parent-message state" (BUILD_PLAN 3.4b-i, VISION §5.2's "short, low-friction
 * confirming question") — a posted confirming question, persisted so a later 👍/👎 reaction on the
 * message it was posted as can be traced back to the question it belongs to and, through it, the
 * original ambient message. `(channelId, messageTs)` uniquely identifies the confirming question's
 * own posted Slack message, mirroring `pending-ticket-draft.ts`'s own `messageTs` semantics exactly
 * — a workflow object with resolve-once CAS semantics, unlike `review-queue-entry.ts`'s
 * deliberately different plain-log shape. `sourceMessageTs`/`sourceMessageText` reference the
 * *original* ambient message, not the confirming question itself — needed so a 👍 answer
 * (BUILD_PLAN 3.4b-ii) can thread the real ticket draft on the message that actually prompted it,
 * the same way 🔁 redo already recomposes from the *original* source message rather than the
 * previous draft's own text. `confidence`/`reasoning` carry the Stage 1 classifier's own output
 * through, so a 👎 answer can log it to `review_queue` with the same context the Low-band path
 * already provides. `resolvedAt` is null until a 👍/👎 reaction claims it
 * (`resolvePendingConfirmingQuestion`, BUILD_PLAN 3.4b-ii) — an unresolved row past some future
 * age threshold is BUILD_PLAN 3.5's own "silence" case to detect and log, not something this table
 * or 3.4b-i/3.4b-ii themselves actively watch for.
 */
export const pendingConfirmingQuestionSchema = z.object({
  id: z.uuid(),
  personaId: nonBlankStringSchema,
  channelId: nonBlankStringSchema,
  messageTs: nonBlankStringSchema,
  sourceMessageTs: nonBlankStringSchema,
  sourceMessageText: nonBlankStringSchema,
  confidence: z.number().int().min(0).max(100),
  reasoning: nonBlankStringSchema,
  resolvedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type PendingConfirmingQuestion = z.infer<
  typeof pendingConfirmingQuestionSchema
>;
