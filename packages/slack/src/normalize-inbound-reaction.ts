import type { InboundReaction } from './inbound-reaction.js';
import type { ProcessableReactionEvent } from './raw-reaction-event.js';

/** Pure mapping from a validated, processable raw Slack reaction event to InboundReaction. */
export function normalizeInboundReaction(
  event: ProcessableReactionEvent,
): InboundReaction {
  return {
    reactionName: event.reaction,
    userId: event.user,
    channelId: event.item.channel,
    messageTs: event.item.ts,
  };
}
