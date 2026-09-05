import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * BUILD_PLAN 6.1b's own brief-artifact record — a Slack message in `#moe-team`
 * (`channel-scoping/team-channel-id.ts`'s `TEAM_CHANNEL_ID`) that carries Sarah's composed brief
 * for a ticket, persisted so a later chunk (6.1d, out of scope here) can find the message and
 * drive the reaction-triggered `Brief`→`Plan` transition. `ticketId` is the natural primary key
 * (a ticket has at most one brief), same 1:1 reasoning `ticket-github-issue-link.ts`'s own
 * `ticketId`-keyed table uses for its own natural key.
 *
 * **No longer pointer-only, as of BUILD_PLAN 6.1c's migration `0026`:** the table originally
 * persisted only `{ticketId, channelId, messageTs}` — the Slack pointer, never the composed
 * `{summary, scope}` content itself, which lived only in-memory inside
 * `composeBriefAndRecordUsage` long enough to render the Slack post, then was discarded. 6.1c's
 * own Plan-stage handler needs to read a Brief's content back to ground a plan (a ticket in `Plan`
 * is expected to have gone through `Brief` first, once the Brief→Plan transition is real), so this
 * table now carries `summary`/`scope` too, making the persisted brief a genuine content record —
 * useful for future audit/debugging/replay, not merely a workaround. `summary`/`scope` are
 * deliberately **not** validated non-empty here (unlike `Brief`'s own schema in
 * `compose-brief.ts`, which does enforce non-empty) — a legacy row inserted before migration
 * `0026` reads back as `summary: ''`/`scope: []` (the migration's own column defaults), and a
 * strict-validation read failure on load would be a worse failure mode than accepting a blank
 * legacy value.
 *
 * Deliberately NOT a claim-then-resolve two-phase table like `ticket-github-issue-link.ts`'s own
 * outbound link, which needs one because a real external GitHub call sits between claim and
 * resolve — here the row is only ever inserted after `postMessage` has already returned a real
 * `ts`, so there's no ambiguous-external-write window to protect against with a pre-claim.
 *
 * **Accepted residual risk:** a DB-write failure on the INSERT itself (the row rejected, a
 * connection blip) is the ordinary "duplicate post next tick" case — `handleBriefStageTicket`
 * logs it and returns, the pull loop releases the claim as usual, and the next tick reclaims and
 * reprocesses. A genuine process crash between a successful `postMessage` and this INSERT is a
 * different, worse case: the pull loop's own unconditional `release()` call
 * (`apps/server/src/pull-loop.ts`) never runs, so `claimedBy` stays set and the ticket is not
 * naturally reclaimed — permanently and silently stuck until BUILD_PLAN 6.6's not-yet-built
 * stale-claim reaper lands. This is the exact same general orphaned-claim gap `pull-loop.ts`'s
 * own doc comment already documents and defers to 6.6 for *any* work step, not something this
 * table introduces new.
 */
export const ticketBriefSchema = z.object({
  ticketId: z.uuid(),
  channelId: nonBlankStringSchema,
  messageTs: nonBlankStringSchema,
  summary: z.string(),
  scope: z.array(z.string()),
  createdAt: z.date(),
});

export type TicketBrief = z.infer<typeof ticketBriefSchema>;
