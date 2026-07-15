import { z } from 'zod';

// The full real Slack channel_type union (verified against @slack/types' GenericMessageEvent) —
// the raw schema accepts all of these so an mpim/app_home event validates as a well-formed
// message and isn't misreported as "failed validation." Only the three this chunk actually
// supports (Alex's app has im:history/channels:history/groups:history scopes, not mpim:history)
// are treated as processable below.
const RAW_CHANNEL_TYPES = [
  'im',
  'channel',
  'group',
  'mpim',
  'app_home',
] as const;
const SUPPORTED_CHANNEL_TYPES = ['im', 'channel', 'group'] as const;
type SupportedChannelType = (typeof SUPPORTED_CHANNEL_TYPES)[number];

/**
 * Deliberately permissive — only the fields normalizeInboundMessage needs. Slack's real `message`
 * event carries many more fields (attachments, blocks, edited, etc.) this chunk doesn't consume.
 */
export const rawSlackMessageEventSchema = z.object({
  type: z.literal('message'),
  channel: z.string().min(1),
  channel_type: z.enum(RAW_CHANNEL_TYPES).optional(),
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
  readonly channel_type: SupportedChannelType;
  readonly text: string;
};

function isSupportedChannelType(
  channelType: RawSlackMessageEvent['channel_type'],
): channelType is SupportedChannelType {
  return (
    channelType !== undefined &&
    (SUPPORTED_CHANNEL_TYPES as readonly string[]).includes(channelType)
  );
}

/**
 * True only for a plain, human-authored, brand-new message in a channel type this chunk supports
 * — never for a bot-authored one (Slack sets `bot_id` on any bot's message, including this
 * persona's own ack replies; skipping these is what stops a reply loop), a subtyped event
 * (edit/delete/join/etc., none of which are new work), or an unsupported channel type (a valid
 * Slack event this app has no scope/handling for yet, e.g. mpim/app_home — skipped silently, not
 * logged as a validation failure, since it isn't one).
 */
export function isProcessableMessageEvent(
  event: RawSlackMessageEvent,
): event is ProcessableMessageEvent {
  return (
    event.bot_id === undefined &&
    event.subtype === undefined &&
    event.user !== undefined &&
    event.text !== undefined &&
    isSupportedChannelType(event.channel_type)
  );
}
