import type { InboundMessage } from '@moe/slack';

const DM_THREAD_KEY = 'dm';

/**
 * Resolves the key BUILD_PLAN 2.4b's conversation history is scoped to. A DM channel is one
 * continuous conversation regardless of Slack's own `thread_ts` (nobody manually "replies in
 * thread" in a DM); a channel/group message only accumulates history inside an explicit Slack
 * thread, so unrelated people/topics sharing a channel don't bleed together. An un-threaded
 * channel/group message returns `undefined` — stateless, identical to BUILD_PLAN 2.4a's behavior.
 */
export function resolveThreadKey(message: InboundMessage): string | undefined {
  if (message.channelType === 'im') return DM_THREAD_KEY;
  return message.threadTs;
}
