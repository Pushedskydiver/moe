import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * The "parent-message state" BUILD_PLAN 3.4a-ii's own text names — a High-band ticket draft
 * (BUILD_PLAN 3.4a-i's `composeTicketDraft`), persisted so a later Slack reaction on the message
 * it was posted as can be traced back to the draft it belongs to. `(channelId, messageTs)`
 * uniquely identifies one Slack message; `resolvedAt` is null until the ✅/📦 outcome path claims
 * it (`resolvePendingTicketDraft`) — 🔁's regenerate path updates `draftTitle`/`draftBody` in
 * place instead, leaving the row open for a further reaction.
 */
export const pendingTicketDraftSchema = z.object({
  id: z.uuid(),
  personaId: nonBlankStringSchema,
  channelId: nonBlankStringSchema,
  messageTs: nonBlankStringSchema,
  sourceMessageText: nonBlankStringSchema,
  draftTitle: nonBlankStringSchema,
  draftBody: nonBlankStringSchema,
  resolvedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type PendingTicketDraft = z.infer<typeof pendingTicketDraftSchema>;
