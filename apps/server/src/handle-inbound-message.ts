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

/**
 * Replies to every inbound message with a single-turn, stateless LLM-generated reply in the
 * placeholder voice (BUILD_PLAN 2.4a — not the persona's real character, which is Stage 5 behind
 * the do-not-touch gate). A failed LLM call is logged and produces no Slack reply at all, the same
 * "log, don't throw, don't retry here" shape as a failed Slack post below — this chunk proves the
 * client wiring end-to-end, not a retry/fallback UX, which stays out of scope.
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
      return;
    }

    const posted = await postMessage(slackClient, {
      channelId: message.channelId,
      text: generated.reply,
      ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
    });
    if (!posted.ok) {
      logger.error('failed to post reply', {
        message: posted.error.message,
      });
    }
  };
}
