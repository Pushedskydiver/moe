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

const VALID_EVENT = {
  type: 'message',
  channel: 'D123',
  channel_type: 'im',
  user: 'U123',
  text: 'hi',
  ts: '1700000000.000100',
};

describe('createSocketModeListener', () => {
  it('start() delegates to the client and logs once connected', async () => {
    const client = makeFakeClient();
    const logger = makeLogger();
    const listener = createSocketModeListener(client, {
      onMessage: vi.fn(),
      logger,
    });

    await listener.start();

    expect(client.start).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('slack socket mode connected');
  });

  it('disconnect() delegates to the client', async () => {
    const client = makeFakeClient();
    const listener = createSocketModeListener(client, {
      onMessage: vi.fn(),
      logger: makeLogger(),
    });

    await listener.disconnect();

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('normalizes and forwards a valid message event to onMessage, and acks it', async () => {
    const client = makeFakeClient();
    const onMessage = vi.fn();
    const ack = vi.fn().mockResolvedValue(undefined);
    createSocketModeListener(client, { onMessage, logger: makeLogger() });

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

  it('logs client-level errors via the injected logger', () => {
    const client = makeFakeClient();
    const logger = makeLogger();
    createSocketModeListener(client, { onMessage: vi.fn(), logger });

    client.emit('error', new Error('websocket blew up'));

    expect(logger.error).toHaveBeenCalledWith('slack socket mode error', {
      message: 'websocket blew up',
    });
  });
});
