/**
 * The normalized shape every Slack `reaction_added` event this persona should act on gets mapped
 * to (BUILD_PLAN 3.4a-ii). Built by `normalizeInboundReaction` from an already-validated raw event
 * — no independent Zod schema, since there's no untrusted-input boundary at this shape (the
 * untrusted boundary is `rawSlackReactionEventSchema`, one step earlier), same precedent as
 * `InboundMessage`/`normalizeInboundMessage`.
 */
export type InboundReaction = {
  readonly reactionName: string;
  readonly userId: string;
  readonly channelId: string;
  readonly messageTs: string;
};
