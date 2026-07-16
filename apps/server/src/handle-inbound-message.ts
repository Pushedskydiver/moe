import type { InboundMessage } from '@moe/slack';

import { generateReply } from '@moe/agents';
import { postMessage } from '@moe/slack';

type GenerateReplyClient = Parameters<typeof generateReply>[0];
type PostMessageClient = Parameters<typeof postMessage>[0];
type InboundMessageLogger = {
  readonly error: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

// Non-persona-voiced, same spirit as chunk 2.3's ACK_TEXT — a visible reply on LLM failure beats
// the silent-to-the-user gap a bare "log and stop" would leave (caught live: DA review on this
// chunk's own PR, comparing against chunk 2.3's baseline where every inbound message got a
// visible ack). Retry/backoff itself stays out of scope for this chunk.
const FALLBACK_TEXT =
  "Sorry, I ran into a problem generating a reply — I've logged it.";

/**
 * Replies to every inbound message with a single-turn, stateless LLM-generated reply in the
 * placeholder voice (BUILD_PLAN 2.4a — not the persona's real character, which is Stage 5 behind
 * the do-not-touch gate). A failed LLM call is logged and still posts a generic fallback reply
 * rather than leaving the user with silence; a failed Slack post (of either the real reply or the
 * fallback) is logged, "log, don't throw, don't retry here" — this chunk proves the client wiring
 * end-to-end, not a full retry/backoff UX, which stays out of scope.
 */
export function createInboundMessageHandler(
  anthropicClient: GenerateReplyClient,
  slackClient: PostMessageClient,
  logger: InboundMessageLogger,
): (message: InboundMessage) => Promise<void> {
  return async (message) => {
    const generated = await generateReply(anthropicClient, {
      text: message.text,
    });

    if (!generated.ok) {
      logger.error('failed to generate reply', {
        message: generated.error.message,
      });
    }

    const posted = await postMessage(slackClient, {
      channelId: message.channelId,
      text: generated.ok ? generated.reply : FALLBACK_TEXT,
      ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
    });
    if (!posted.ok) {
      logger.error('failed to post reply', {
        message: posted.error.message,
      });
    }
  };
}
