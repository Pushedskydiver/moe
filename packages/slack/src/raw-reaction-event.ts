import { z } from 'zod';

/**
 * Deliberately permissive — only the fields `normalizeInboundReaction` needs. Slack's real
 * `reaction_added` event also carries `item_user`, this chunk doesn't consume it. `item.type` is
 * validated as a bare string (not narrowed to `'message'` here) so an item this chunk doesn't
 * support (a reaction on a file, for instance) still validates as well-formed — rejecting it
 * happens one step later, in `isProcessableReactionEvent`, same "valid Slack event, no handling
 * for it" split `raw-message-event.ts`'s own `channel_type` already uses.
 */
export const rawSlackReactionEventSchema = z.object({
  type: z.literal('reaction_added'),
  user: z.string().min(1),
  reaction: z.string().min(1),
  item: z.object({
    type: z.string().min(1),
    channel: z.string().min(1),
    ts: z.string().min(1),
  }),
  event_ts: z.string().min(1),
});

export type RawSlackReactionEvent = z.infer<typeof rawSlackReactionEventSchema>;

/** Narrowed shape once `isProcessableReactionEvent` confirms `item.type` is `'message'`. */
export type ProcessableReactionEvent = RawSlackReactionEvent & {
  readonly item: { readonly type: 'message' };
};

/**
 * True only for a reaction added to a message (not a file, not a Slack post/canvas) — the only
 * item type BUILD_PLAN 3.4a-ii's pending-ticket-draft lookup (keyed on `channelId`/`messageTs`)
 * has any meaning for.
 */
export function isProcessableReactionEvent(
  event: RawSlackReactionEvent,
): event is ProcessableReactionEvent {
  return event.item.type === 'message';
}
