import { describe, expect, it, vi } from 'vitest';

import { createInboundMessageHandler } from './handle-inbound-message.js';

function makeClient(response: {
  readonly ok: boolean;
  readonly error?: string;
}) {
  return { chat: { postMessage: vi.fn().mockResolvedValue(response) } };
}

function makeLogger() {
  return { error: vi.fn() };
}

const MESSAGE = {
  channelId: 'D123',
  channelType: 'im' as const,
  userId: 'U123',
  text: 'can you help with something',
  ts: '1700000000.000100',
};

describe('createInboundMessageHandler', () => {
  it('replies in the same channel with a non-empty, non-persona-voiced acknowledgment', async () => {
    const client = makeClient({ ok: true });
    const handler = createInboundMessageHandler(client, makeLogger());

    await handler(MESSAGE);

    expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
    const call = client.chat.postMessage.mock.calls[0]?.[0] as {
      channel: string;
      text: string;
      thread_ts?: string;
    };
    expect(call.channel).toBe('D123');
    expect(call.text.length).toBeGreaterThan(0);
    expect(call.thread_ts).toBeUndefined();
  });

  it('replies in the thread when the inbound message was threaded', async () => {
    const client = makeClient({ ok: true });
    const handler = createInboundMessageHandler(client, makeLogger());

    await handler({ ...MESSAGE, threadTs: '1699999999.000100' });

    const call = client.chat.postMessage.mock.calls[0]?.[0] as {
      thread_ts?: string;
    };
    expect(call.thread_ts).toBe('1699999999.000100');
  });

  it('logs an error, without throwing, when the reply fails to send', async () => {
    const client = makeClient({ ok: false, error: 'channel_not_found' });
    const logger = makeLogger();
    const handler = createInboundMessageHandler(client, logger);

    await expect(handler(MESSAGE)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('failed to post acknowledgment', {
      message: 'channel_not_found',
    });
  });
});
