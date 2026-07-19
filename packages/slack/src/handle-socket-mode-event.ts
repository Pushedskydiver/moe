import type { InboundMessage } from './inbound-message.js';
import type { SeenEventCache } from './seen-event-cache.js';

import { normalizeInboundMessage } from './normalize-inbound-message.js';
import {
  isProcessableMessageEvent,
  rawSlackMessageEventSchema,
} from './raw-message-event.js';

type EventLogger = {
  readonly warn: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

export type HandleSocketModeEventDeps = {
  readonly ack: () => Promise<void>;
  readonly onMessage: (message: InboundMessage) => void | Promise<void>;
  readonly logger: EventLogger;
  readonly seenEventCache: SeenEventCache;
};

/**
 * Orchestrates one Socket Mode `message` event: ack immediately (Slack expects this within a few
 * seconds regardless of how long `onMessage` takes), skip a redelivery of an event id already
 * processed (`eventId`, Slack's own stable id across retries — see `seen-event-cache.ts`'s own
 * TSDoc for why this is the correct dedup key), validate the raw payload, skip bot-authored or
 * subtyped events (edits/deletes/joins are never new work, and skipping bot-authored ones is what
 * stops the persona replying to its own ack — a reply loop), normalize, then hand off.
 * `eventId` can be `undefined` (a malformed/synthetic payload missing it) — dedup is skipped
 * entirely in that case rather than blocking; a real duplicate delivery double-processed is a
 * smaller failure than a genuine new message silently dropped.
 */
export async function handleSocketModeEvent(
  rawEvent: unknown,
  eventId: string | undefined,
  deps: HandleSocketModeEventDeps,
): Promise<void> {
  await deps.ack();

  if (eventId !== undefined) {
    if (deps.seenEventCache.hasSeen(eventId)) {
      return;
    }
    deps.seenEventCache.markSeen(eventId);
  }

  const parsed = rawSlackMessageEventSchema.safeParse(rawEvent);
  if (!parsed.success) {
    deps.logger.warn('received a message event that failed validation', {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return;
  }

  if (!isProcessableMessageEvent(parsed.data)) {
    return;
  }

  await deps.onMessage(normalizeInboundMessage(parsed.data));
}
