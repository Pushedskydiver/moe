import { z } from 'zod';

/**
 * Deliberately permissive — only the fields normalizeInboundMessage needs. Slack's real `message`
 * event carries many more fields (attachments, blocks, edited, etc.) this chunk doesn't consume.
 */
export const rawSlackMessageEventSchema = z.object({
  type: z.literal('message'),
  channel: z.string().min(1),
  channel_type: z.enum(['im', 'channel', 'group']).optional(),
  user: z.string().min(1).optional(),
  text: z.string().optional(),
  ts: z.string().min(1),
  thread_ts: z.string().min(1).optional(),
  subtype: z.string().optional(),
  bot_id: z.string().optional(),
});

export type RawSlackMessageEvent = z.infer<typeof rawSlackMessageEventSchema>;

/** Narrowed shape once isProcessableMessageEvent confirms the fields normalizeInboundMessage needs are present. */
export type ProcessableMessageEvent = RawSlackMessageEvent & {
  readonly user: string;
  readonly channel_type: 'im' | 'channel' | 'group';
  readonly text: string;
};

/**
 * True only for a plain, human-authored, brand-new message — never for a bot-authored one (Slack
 * sets `bot_id` on any bot's message, including this persona's own ack replies; skipping these is
 * what stops a reply loop) or a subtyped event (edit/delete/join/etc., none of which are new work).
 */
export function isProcessableMessageEvent(
  event: RawSlackMessageEvent,
): event is ProcessableMessageEvent {
  return (
    event.bot_id === undefined &&
    event.subtype === undefined &&
    event.user !== undefined &&
    event.channel_type !== undefined &&
    event.text !== undefined
  );
}
