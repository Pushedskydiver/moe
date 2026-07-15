import type { InboundMessage } from './inbound-message.js';

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
};

/**
 * Orchestrates one Socket Mode `message` event: ack immediately (Slack expects this within a few
 * seconds regardless of how long `onMessage` takes), validate the raw payload, skip bot-authored
 * or subtyped events (edits/deletes/joins are never new work, and skipping bot-authored ones is
 * what stops the persona replying to its own ack — a reply loop), normalize, then hand off.
 */
export async function handleSocketModeEvent(
  rawEvent: unknown,
  deps: HandleSocketModeEventDeps,
): Promise<void> {
  await deps.ack();

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
