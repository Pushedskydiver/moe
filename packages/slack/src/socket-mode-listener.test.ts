import type { CreateSocketModeListenerOpts } from './socket-mode-listener.js';

import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { createSocketModeListener } from './socket-mode-listener.js';

function makeFakeClient() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    start: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  });
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeOpts(
  overrides: Partial<{
    readonly onMessage: CreateSocketModeListenerOpts['onMessage'];
    readonly onReactionAdded: CreateSocketModeListenerOpts['onReactionAdded'];
    readonly botUserId: string;
    readonly logger: ReturnType<typeof makeLogger>;
  }> = {},
): CreateSocketModeListenerOpts {
  return {
    onMessage: vi.fn(),
    onReactionAdded: vi.fn(),
    botUserId: 'UBOTSARAH',
    logger: makeLogger(),
    ...overrides,
  };
}

const VALID_EVENT = {
  type: 'message',
  channel: 'D123',
  channel_type: 'im',
  user: 'U123',
  text: 'hi',
  ts: '1700000000.000100',
};

const VALID_REACTION_EVENT = {
  type: 'reaction_added',
  user: 'U123',
  reaction: 'white_check_mark',
  item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
  event_ts: '1700000000.000200',
};

describe('createSocketModeListener', () => {
  it('start() delegates to the client and logs once connected', async () => {
    const client = makeFakeClient();
    const logger = makeLogger();
    const listener = createSocketModeListener(client, makeOpts({ logger }));

    await listener.start();

    expect(client.start).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('slack socket mode connected');
  });

  it('disconnect() delegates to the client', async () => {
    const client = makeFakeClient();
    const listener = createSocketModeListener(client, makeOpts());

    await listener.disconnect();

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('normalizes and forwards a valid message event to onMessage, and acks it', async () => {
    const client = makeFakeClient();
    const onMessage = vi.fn();
    const ack = vi.fn().mockResolvedValue(undefined);
    createSocketModeListener(client, makeOpts({ onMessage }));

    client.emit('message', { ack, event: VALID_EVENT });

    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
    expect(onMessage).toHaveBeenCalledWith({
      channelId: 'D123',
      channelType: 'im',
      userId: 'U123',
      text: 'hi',
      ts: '1700000000.000100',
    });
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('normalizes and forwards a valid reaction_added event to onReactionAdded, and acks it', async () => {
    const client = makeFakeClient();
    const onReactionAdded = vi.fn();
    const ack = vi.fn().mockResolvedValue(undefined);
    createSocketModeListener(client, makeOpts({ onReactionAdded }));

    client.emit('reaction_added', { ack, event: VALID_REACTION_EVENT });

    await vi.waitFor(() => expect(onReactionAdded).toHaveBeenCalledTimes(1));
    expect(onReactionAdded).toHaveBeenCalledWith({
      reactionName: 'white_check_mark',
      userId: 'U123',
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('logs client-level errors via the injected logger', () => {
    const client = makeFakeClient();
    const logger = makeLogger();
    createSocketModeListener(client, makeOpts({ logger }));

    client.emit('error', new Error('websocket blew up'));

    expect(logger.error).toHaveBeenCalledWith('slack socket mode error', {
      message: 'websocket blew up',
    });
  });
});
