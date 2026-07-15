import type { InboundMessage } from './inbound-message.js';
import type { ProcessableMessageEvent } from './raw-message-event.js';

/** Pure mapping from a validated, processable raw Slack event to the internal InboundMessage shape. */
export function normalizeInboundMessage(
  event: ProcessableMessageEvent,
): InboundMessage {
  return {
    channelId: event.channel,
    channelType: event.channel_type,
    userId: event.user,
    text: event.text,
    ts: event.ts,
    ...(event.thread_ts !== undefined ? { threadTs: event.thread_ts } : {}),
  };
}
