import type { InboundMessage } from '@moe/slack';

const DM_THREAD_KEY = 'dm';

/**
 * Resolves the key BUILD_PLAN 2.4b's conversation history is scoped to. A DM channel is one
 * continuous conversation regardless of Slack's own `thread_ts` (nobody manually "replies in
 * thread" in a DM). The `undefined` case (an un-threaded channel/group message specifically — a
 * threaded channel/group reply returns its real `threadTs`, not `undefined`) is moot in practice
 * since BUILD_PLAN 3.3: `handle-inbound-message.ts` routes every non-DM message to
 * `handle-ambient-channel-message.ts` before this function is ever called, so this function's only
 * live caller passes it a DM every time. Still true after BUILD_PLAN 3.7 — that chunk gave DMs
 * their own intake cascade but did not change which surface reaches this function.
 */
export function resolveThreadKey(message: InboundMessage): string | undefined {
  if (message.channelType === 'im') return DM_THREAD_KEY;
  return message.threadTs;
}
