/**
 * The normalized shape every Slack message this persona should act on gets mapped to, regardless
 * of whether the raw event was a DM, public channel, or private group message. Built by
 * normalizeInboundMessage from an already-validated raw event — no independent Zod schema, since
 * there's no untrusted-input boundary at this shape (the untrusted boundary is
 * rawSlackMessageEventSchema, one step earlier).
 */
export type InboundMessage = {
  readonly channelId: string;
  readonly channelType: 'im' | 'channel' | 'group';
  readonly userId: string;
  readonly text: string;
  readonly ts: string;
  readonly threadTs?: string;
};
