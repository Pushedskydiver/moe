import type { InboundReaction } from './inbound-reaction.js';

import { normalizeInboundReaction } from './normalize-inbound-reaction.js';
import {
  isProcessableReactionEvent,
  rawSlackReactionEventSchema,
} from './raw-reaction-event.js';

type EventLogger = {
  readonly warn: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

export type HandleSocketModeReactionEventDeps = {
  readonly ack: () => Promise<void>;
  readonly onReactionAdded: (reaction: InboundReaction) => void | Promise<void>;
  // This persona's own Slack user id (`fetchBotUserId`, fetched once at process startup) — a
  // `reactions.add` call this persona makes on its own posted draft (BUILD_PLAN 3.4a-i/iii's
  // reaction-gate legend) itself emits a real `reaction_added` event with `user` set to this same
  // id; without filtering it out here, every posted draft would immediately (mis)dispatch three
  // real outcome actions against itself. Unlike `raw-message-event.ts`'s `bot_id` filter, this
  // can't be a structural check on the raw event alone — Slack's `reaction_added` event has no
  // separate bot marker, so the comparison needs this runtime-known value (DA review, chunk
  // 3.4a-ii's own documented known gap).
  readonly botUserId: string;
  readonly logger: EventLogger;
};

/**
 * Orchestrates one Socket Mode `reaction_added` event: ack immediately (same reasoning as
 * `handle-socket-mode-event.ts`'s `message` sibling), validate the raw payload, skip a reaction on
 * an unsupported item type (not a message) or a self-authored one, normalize, then hand off.
 */
export async function handleSocketModeReactionEvent(
  rawEvent: unknown,
  deps: HandleSocketModeReactionEventDeps,
): Promise<void> {
  await deps.ack();

  const parsed = rawSlackReactionEventSchema.safeParse(rawEvent);
  if (!parsed.success) {
    deps.logger.warn('received a reaction_added event that failed validation', {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return;
  }

  if (!isProcessableReactionEvent(parsed.data)) {
    return;
  }

  const reaction = normalizeInboundReaction(parsed.data);
  if (reaction.userId === deps.botUserId) {
    return;
  }

  await deps.onReactionAdded(reaction);
}
