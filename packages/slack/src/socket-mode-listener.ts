import type { InboundMessage } from './inbound-message.js';
import type { InboundReaction } from './inbound-reaction.js';

import { handleSocketModeEvent } from './handle-socket-mode-event.js';
import { handleSocketModeReactionEvent } from './handle-socket-mode-reaction-event.js';

type ListenerLogger = {
  readonly info: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly warn: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly error: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

// Matches the real EventEmitter#on listener signature (Node's node:events and eventemitter3,
// which SocketModeClient extends, both type listener args this loosely) — not application data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventListener = (...args: readonly any[]) => void;

/**
 * Structural subset of `@slack/socket-mode`'s `SocketModeClient` — an EventEmitter with
 * `start`/`disconnect`. Accepting this shape rather than the concrete class is what makes this
 * module testable with a plain `node:events` EventEmitter instead of mocking the SDK.
 */
type SocketModeLikeClient = {
  readonly on: (event: string, listener: EventListener) => unknown;
  readonly start: () => Promise<unknown>;
  readonly disconnect: () => Promise<void>;
};

export type SocketModeListener = {
  readonly start: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

export type CreateSocketModeListenerOpts = {
  readonly onMessage: (message: InboundMessage) => void | Promise<void>;
  readonly onReactionAdded: (reaction: InboundReaction) => void | Promise<void>;
  // Threaded straight into `handleSocketModeReactionEvent`'s own self-authored-reaction filter —
  // see that module's TSDoc for why this can't be a structural check like `message`'s `bot_id`.
  readonly botUserId: string;
  readonly logger: ListenerLogger;
};

type SocketModeEventPayload = {
  readonly ack: () => Promise<void>;
  readonly event: unknown;
};

// Extracted from `createSocketModeListener` purely to stay under eslint's `max-lines-per-function`
// (`docs/CONVENTIONS.md` §Code Style) — registers the `message` listener. EventEmitter never
// awaits a listener's return value, so an async listener here would leave a rejection unhandled —
// caught explicitly rather than returning the promise.
function registerMessageListener(
  client: SocketModeLikeClient,
  opts: CreateSocketModeListenerOpts,
): void {
  client.on('message', ({ ack, event }: SocketModeEventPayload) => {
    handleSocketModeEvent(event, {
      ack,
      onMessage: opts.onMessage,
      logger: opts.logger,
    }).catch((error: unknown) => {
      opts.logger.error('failed to handle slack message event', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

// Same extraction reasoning as `registerMessageListener` above, for the `reaction_added` listener.
function registerReactionAddedListener(
  client: SocketModeLikeClient,
  opts: CreateSocketModeListenerOpts,
): void {
  client.on('reaction_added', ({ ack, event }: SocketModeEventPayload) => {
    handleSocketModeReactionEvent(event, {
      ack,
      onReactionAdded: opts.onReactionAdded,
      botUserId: opts.botUserId,
      logger: opts.logger,
    }).catch((error: unknown) => {
      opts.logger.error('failed to handle slack reaction_added event', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

/**
 * Wires a Socket Mode client's `message`/`reaction_added`/`error` events into
 * handleSocketModeEvent's/handleSocketModeReactionEvent's tested orchestration. The client itself
 * is injected already-constructed (real `SocketModeClient` in production, `node:events`'
 * `EventEmitter` in tests) — this module owns only the wiring.
 */
export function createSocketModeListener(
  client: SocketModeLikeClient,
  opts: CreateSocketModeListenerOpts,
): SocketModeListener {
  client.on('error', (error: unknown) => {
    opts.logger.error('slack socket mode error', {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  registerMessageListener(client, opts);
  registerReactionAddedListener(client, opts);

  return {
    start: async () => {
      await client.start();
      opts.logger.info('slack socket mode connected');
    },
    disconnect: () => client.disconnect(),
  };
}
