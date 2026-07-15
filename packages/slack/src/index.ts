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
