export function getPackageName(): string {
  return '@moe/slack';
}

export type { InboundMessage } from './inbound-message.js';
export type {
  CreateSocketModeListenerOpts,
  SocketModeListener,
} from './socket-mode-listener.js';
export { createSocketModeListener } from './socket-mode-listener.js';
export {
  createSocketModeClient,
  createWebClient,
} from './create-slack-clients.js';
export type { PostMessageResult } from './post-message.js';
export { postMessage } from './post-message.js';
export { isUnrecoverableStartError } from './is-unrecoverable-start-error.js';

export type { AwayKeywords } from './away-detection/away-keywords.js';
export { DEFAULT_AWAY_KEYWORDS } from './away-detection/away-keywords.js';
export type {
  FetchSlackStatusError,
  FetchSlackStatusResult,
  SlackStatus,
} from './away-detection/fetch-slack-status.js';
export { fetchSlackStatus } from './away-detection/fetch-slack-status.js';
export { isAway } from './away-detection/is-away.js';

export type { ReactionOutcome } from './classify-reaction-outcome.js';
export { classifyReactionOutcome } from './classify-reaction-outcome.js';
export type { InboundReaction } from './inbound-reaction.js';
export type {
  ProcessableReactionEvent,
  RawSlackReactionEvent,
} from './raw-reaction-event.js';
export {
  isProcessableReactionEvent,
  rawSlackReactionEventSchema,
} from './raw-reaction-event.js';
export { normalizeInboundReaction } from './normalize-inbound-reaction.js';
