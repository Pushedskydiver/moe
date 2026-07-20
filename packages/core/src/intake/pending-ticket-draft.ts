import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * BUILD_PLAN 3.6 — which Stage 2 band produced this draft: `'high-band'` is the direct
 * auto-draft path (`composeAndPostDraft`, `handle-ambient-channel-message.ts`); `'mid-band-
 * confirmed'` is a Mid-band confirming question's own 👍 outcome (`draftFromConfirmingQuestion`,
 * `reaction-outcome-actions.ts`), which has already passed a human-confirmation gate before a
 * draft is even composed. Domain-meaningful (unlike `redoCount`, below) — `getDraftOutcomeCounts`
 * (`./draft-outcome-counts.ts`) filters to `'high-band'` only, since VISION §5.2's own text ties
 * "ignored/corrected draft" specifically to the High-confidence bullet, not Mid-confidence's
 * separate confirming-question action — a Mid-band-confirmed draft getting ignored *after* a human
 * already said yes to drafting it isn't the classifier-miscalibration signal §5.4 names.
 */
export const draftOriginSchema = z.enum(['high-band', 'mid-band-confirmed']);

export type DraftOrigin = z.infer<typeof draftOriginSchema>;

/**
 * The "parent-message state" BUILD_PLAN 3.4a-ii's own text names — a ticket draft (BUILD_PLAN
 * 3.4a-i's `composeTicketDraft`) persisted so a later Slack reaction on the message it was posted
 * as can be traced back to the draft it belongs to. Written by both the High-band auto-draft path
 * and the Mid-band 👍-confirmed path (`origin` distinguishes which, above). `(channelId,
 * messageTs)` uniquely identifies one Slack message; `resolvedAt` is null until the ✅/📦 outcome
 * path claims it (`resolvePendingTicketDraft`) — 🔁's regenerate path updates
 * `draftTitle`/`draftBody` in place instead, leaving the row open for a further reaction.
 * `redoCount` (BUILD_PLAN 3.6) is `Generated<number>` at the Kysely level (`../schema.ts`) but
 * deliberately excluded here — a tracking/derivation field, not part of the domain shape a caller
 * round-trips through the app, same reasoning `ticketSchema` excludes `version`/`claimedBy`.
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
  origin: draftOriginSchema,
});

export type PendingTicketDraft = z.infer<typeof pendingTicketDraftSchema>;
