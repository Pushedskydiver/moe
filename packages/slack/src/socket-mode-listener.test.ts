import type { CreateSocketModeListenerOpts } from './socket-mode-listener.js';

import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { createSeenEventCache } from './seen-event-cache.js';
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
    readonly seenEventCache: CreateSocketModeListenerOpts['seenEventCache'];
  }> = {},
): CreateSocketModeListenerOpts {
  return {
    onMessage: vi.fn(),
    onReactionAdded: vi.fn(),
    botUserId: 'UBOTSARAH',
    logger: makeLogger(),
    seenEventCache: createSeenEventCache(),
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

    client.emit('message', {
      ack,
      event: VALID_EVENT,
      body: { event_id: 'Ev123' },
    });

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

    client.emit('reaction_added', {
      ack,
      event: VALID_REACTION_EVENT,
      body: { event_id: 'Ev456' },
    });

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
      errorMessage: 'websocket blew up',
    });
  });

  it("acks but does not call onMessage twice for a redelivered message event sharing the same event_id (BUILD_PLAN follow-up on 3.4c's DA finding)", async () => {
    const client = makeFakeClient();
    const onMessage = vi.fn();
    const ack = vi.fn().mockResolvedValue(undefined);
    createSocketModeListener(client, makeOpts({ onMessage }));

    client.emit('message', {
      ack,
      event: VALID_EVENT,
      body: { event_id: 'Ev123' },
    });
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));

    client.emit('message', {
      ack,
      event: VALID_EVENT,
      body: { event_id: 'Ev123' },
    });
    await vi.waitFor(() => expect(ack).toHaveBeenCalledTimes(2));

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('acks but does not call onReactionAdded twice for a redelivered reaction_added event sharing the same event_id — closes the known 🔁-redo double-fire gap', async () => {
    const client = makeFakeClient();
    const onReactionAdded = vi.fn();
    const ack = vi.fn().mockResolvedValue(undefined);
    createSocketModeListener(client, makeOpts({ onReactionAdded }));

    client.emit('reaction_added', {
      ack,
      event: VALID_REACTION_EVENT,
      body: { event_id: 'Ev456' },
    });
    await vi.waitFor(() => expect(onReactionAdded).toHaveBeenCalledTimes(1));

    client.emit('reaction_added', {
      ack,
      event: VALID_REACTION_EVENT,
      body: { event_id: 'Ev456' },
    });
    await vi.waitFor(() => expect(ack).toHaveBeenCalledTimes(2));

    expect(onReactionAdded).toHaveBeenCalledTimes(1);
  });

  it('still processes a message event with a different event_id after a prior one — dedup is per event_id, not a global one-shot switch', async () => {
    const client = makeFakeClient();
    const onMessage = vi.fn();
    const ack = vi.fn().mockResolvedValue(undefined);
    createSocketModeListener(client, makeOpts({ onMessage }));

    client.emit('message', {
      ack,
      event: VALID_EVENT,
      body: { event_id: 'Ev123' },
    });
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));

    client.emit('message', {
      ack,
      event: { ...VALID_EVENT, ts: '1700000000.000200' },
      body: { event_id: 'Ev999' },
    });
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(2));
  });

  it("forgets a failed message event's id so a genuine Slack retry gets a real second attempt, rather than being silently swallowed (DA review follow-up)", async () => {
    const client = makeFakeClient();
    const onMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('db unavailable'));
    const ack = vi.fn().mockResolvedValue(undefined);
    const logger = makeLogger();
    createSocketModeListener(client, makeOpts({ onMessage, logger }));

    client.emit('message', {
      ack,
      event: VALID_EVENT,
      body: { event_id: 'Ev123' },
    });
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'failed to handle slack message event',
        expect.objectContaining({ eventId: 'Ev123' }),
      ),
    );

    client.emit('message', {
      ack,
      event: VALID_EVENT,
      body: { event_id: 'Ev123' },
    });

    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(2));
  });

  it("forgets a failed reaction_added event's id so a genuine Slack retry gets a real second attempt — most consequential for 🔁 redo, which has no other retry protection", async () => {
    const client = makeFakeClient();
    const onReactionAdded = vi
      .fn()
      .mockRejectedValueOnce(new Error('anthropic rate limited'));
    const ack = vi.fn().mockResolvedValue(undefined);
    const logger = makeLogger();
    createSocketModeListener(client, makeOpts({ onReactionAdded, logger }));

    client.emit('reaction_added', {
      ack,
      event: VALID_REACTION_EVENT,
      body: { event_id: 'Ev456' },
    });
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'failed to handle slack reaction_added event',
        expect.objectContaining({ eventId: 'Ev456' }),
      ),
    );

    client.emit('reaction_added', {
      ack,
      event: VALID_REACTION_EVENT,
      body: { event_id: 'Ev456' },
    });

    await vi.waitFor(() => expect(onReactionAdded).toHaveBeenCalledTimes(2));
  });
});
