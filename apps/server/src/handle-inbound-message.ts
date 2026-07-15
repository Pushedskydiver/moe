import type { InboundMessage } from '@moe/slack';

import { postMessage } from '@moe/slack';

// Deliberately generic, non-persona voice — Sarah's actual character is Stage 5 behind the
// do-not-touch gate (packages/agents/src/personas/*/prompt.md), same principle as BUILD_PLAN 2.4a's
// placeholder reply. No LLM yet at this chunk; this is the whole reply.
const ACK_TEXT = "Got it — I heard you, but I can't act on this yet.";

type PostMessageClient = Parameters<typeof postMessage>[0];
type AckLogger = {
  readonly error: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

/** Replies to every inbound message with a hardcoded acknowledgment (BUILD_PLAN 2.3 — no LLM yet). */
export function createInboundMessageHandler(
  client: PostMessageClient,
  logger: AckLogger,
): (message: InboundMessage) => Promise<void> {
  return async (message) => {
    const result = await postMessage(client, {
      channelId: message.channelId,
      text: ACK_TEXT,
      ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
    });
    if (!result.ok) {
      logger.error('failed to post acknowledgment', {
        message: result.error.message,
      });
    }
  };
}
