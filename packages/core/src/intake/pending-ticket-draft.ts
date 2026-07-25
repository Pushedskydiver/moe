import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * BUILD_PLAN 3.6 — which Stage 2 band, on which surface, produced this draft: `'high-band'` is
 * the ambient channel/group auto-draft path (`composeAndPostDraft`,
 * `handle-ambient-channel-message.ts`); `'mid-band-confirmed'` is a Mid-band confirming question's
 * own 👍 outcome (`draftFromConfirmingQuestion`, `reaction-outcome-actions.ts`), which has already
 * passed a human-confirmation gate before a draft is even composed; `'high-band-dm'` (BUILD_PLAN
 * 3.7) is a DM that classified High-band (`run-dm-intake-cascade.ts`).
 *
 * Domain-meaningful (unlike `redoCount`, below) — `getDraftOutcomeCounts`
 * (`./draft-outcome-counts.ts`) filters to `'high-band'` only, since VISION §5.2's own text ties
 * "ignored/corrected draft" specifically to the High-confidence bullet, not Mid-confidence's
 * separate confirming-question action — a Mid-band-confirmed draft getting ignored *after* a human
 * already said yes to drafting it isn't the classifier-miscalibration signal §5.4 names. A DM
 * draft is excluded for a parallel but distinct reason: §5.2's Stage 0 scopes the cascade to
 * surfaces "the team already treats as work-relevant", and §5.3 settles a DM to a named persona as
 * *already* unambiguous — so a DM is a systematically higher-propensity population than an ambient
 * channel message, and mixing the two would skew the ambient rate the same way 3.6's own DA-caught
 * defect did.
 *
 * Surfacing a *separate* DM acceptance rate in the 3.5 sweep digest is deliberately deferred, not
 * dropped — see BUILD_PLAN 3.7's own entry for the deferral and its re-entry condition. **The
 * surface axis is deliberately only half-applied, and that bounds what the deferral can be:** only
 * the High band distinguishes surfaces. A Mid-band 👍-confirmed draft writes `'mid-band-confirmed'`
 * whatever surface it came from (`draftFromConfirmingQuestion`), so a DM-only *Mid* population
 * would still need a migration. That is deliberate rather than an oversight — `getDraftOutcomeCounts`
 * excludes `'mid-band-confirmed'` entirely on either surface, so nothing is being skewed today, and
 * inventing a fourth value with no consumer would be speculative. Widen it if and when a Mid-band
 * DM population is actually wanted.
 */
export const draftOriginSchema = z.enum([
  'high-band',
  'mid-band-confirmed',
  'high-band-dm',
]);

export type DraftOrigin = z.infer<typeof draftOriginSchema>;

/**
 * The "parent-message state" BUILD_PLAN 3.4a-ii's own text names — a ticket draft (BUILD_PLAN
 * 3.4a-i's `composeTicketDraft`) persisted so a later Slack reaction on the message it was posted
 * as can be traced back to the draft it belongs to. Written by the ambient High-band auto-draft
 * path, the Mid-band 👍-confirmed path, and the DM High-band path (`origin` distinguishes which,
 * above). `(channelId,
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
