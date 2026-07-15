import type { InboundMessage } from './inbound-message.js';

import { handleSocketModeEvent } from './handle-socket-mode-event.js';

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
  readonly logger: ListenerLogger;
};

/**
 * Wires a Socket Mode client's `message`/`error` events into handleSocketModeEvent's tested
 * orchestration. The client itself is injected already-constructed (real `SocketModeClient` in
 * production, `node:events`' `EventEmitter` in tests) — this module owns only the wiring.
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

  client.on(
    'message',
    ({
      ack,
      event,
    }: {
      readonly ack: () => Promise<void>;
      readonly event: unknown;
    }) => {
      // EventEmitter never awaits a listener's return value, so an async listener here would
      // leave a rejection unhandled — catch explicitly instead of returning the promise.
      handleSocketModeEvent(event, {
        ack,
        onMessage: opts.onMessage,
        logger: opts.logger,
      }).catch((error: unknown) => {
        opts.logger.error('failed to handle slack message event', {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    },
  );

  return {
    start: async () => {
      await client.start();
      opts.logger.info('slack socket mode connected');
    },
    disconnect: () => client.disconnect(),
  };
}
