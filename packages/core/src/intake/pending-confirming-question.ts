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
 * original source message. `(channelId, messageTs)` uniquely identifies the confirming question's
 * own posted Slack message, mirroring `pending-ticket-draft.ts`'s own `messageTs` semantics exactly
 * — a workflow object with resolve-once CAS semantics, unlike `review-queue-entry.ts`'s
 * deliberately different plain-log shape. `sourceMessageTs`/`sourceMessageText` reference the
 * *original* source message — an ambient channel/group message, or, since BUILD_PLAN 3.7, a DM —
 * not the confirming question itself — needed so a 👍 answer
 * (BUILD_PLAN 3.4b-ii) can thread the real ticket draft on the message that actually prompted it,
 * the same way 🔁 redo already recomposes from the *original* source message rather than the
 * previous draft's own text. `confidence`/`reasoning` carry the Stage 1 classifier's own output
 * through, so a 👎 answer can log it to `review_queue` with the same context the Low-band path
 * already provides. `resolvedAt` is null until a 👍/👎 reaction claims it
 * (`resolvePendingConfirmingQuestion`, BUILD_PLAN 3.4b-ii) — an unresolved row past some future
 * age threshold is BUILD_PLAN 3.5's own "silence" case to detect and log, not something this table
 * or 3.4b-i/3.4b-ii themselves actively watch for.
 */
/**
 * Which VISION §5.2 surface the question was asked on (BUILD_PLAN 3.7). Load-bearing rather than
 * descriptive: Alex settled at 3.7 that a DM-triggered post lands **top-level** in the DM while an
 * ambient one stays threaded on its source message, and the 👍 outcome
 * (`draftFromConfirmingQuestion`) posts its draft long after the original `InboundMessage` is gone,
 * so this column is the only thing that can tell it which to do. Deliberately mirrors
 * `MessageSurface`'s own `kind` vocabulary rather than inventing a second one.
 */
const questionSourceSurfaceSchema = z.enum(['channel', 'dm']);

export type QuestionSourceSurface = z.infer<typeof questionSourceSurfaceSchema>;

export const pendingConfirmingQuestionSchema = z.object({
  id: z.uuid(),
  personaId: nonBlankStringSchema,
  channelId: nonBlankStringSchema,
  messageTs: nonBlankStringSchema,
  sourceSurface: questionSourceSurfaceSchema,
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
