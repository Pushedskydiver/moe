import { describe, expect, it, vi } from 'vitest';

import { createInboundMessageHandler } from './handle-inbound-message.js';

function makeSlackClient(response: {
  readonly ok: boolean;
  readonly error?: string;
}) {
  return { chat: { postMessage: vi.fn().mockResolvedValue(response) } };
}

function makeAnthropicClient(
  response:
    | {
        readonly content: ReadonlyArray<{
          readonly type: string;
          readonly text?: string;
        }>;
      }
    | (() => never),
) {
  return {
    messages: {
      create:
        typeof response === 'function'
          ? vi.fn(response)
          : vi.fn().mockResolvedValue(response),
    },
  };
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

const REPLY_MESSAGE = {
  content: [{ type: 'text', text: 'Sure, tell me more.' }],
};

describe('createInboundMessageHandler', () => {
  it('generates a reply from the inbound text and posts it back in the same channel', async () => {
    const anthropicClient = makeAnthropicClient(REPLY_MESSAGE);
    const slackClient = makeSlackClient({ ok: true });
    const handler = createInboundMessageHandler(
      anthropicClient,
      slackClient,
      makeLogger(),
    );

    await handler(MESSAGE);

    expect(anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: MESSAGE.text }],
      }),
    );
    expect(slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D123',
        text: 'Sure, tell me more.',
      }),
    );
  });

  it('replies in the thread when the inbound message was threaded', async () => {
    const anthropicClient = makeAnthropicClient(REPLY_MESSAGE);
    const slackClient = makeSlackClient({ ok: true });
    const handler = createInboundMessageHandler(
      anthropicClient,
      slackClient,
      makeLogger(),
    );

    await handler({ ...MESSAGE, threadTs: '1699999999.000100' });

    const call = slackClient.chat.postMessage.mock.calls[0]?.[0] as {
      thread_ts?: string;
    };
    expect(call.thread_ts).toBe('1699999999.000100');
  });

  it('logs an error and posts a generic fallback reply when the LLM call fails — not silence', async () => {
    const anthropicClient = makeAnthropicClient(() => {
      throw new Error('rate limited');
    });
    const slackClient = makeSlackClient({ ok: true });
    const logger = makeLogger();
    const handler = createInboundMessageHandler(
      anthropicClient,
      slackClient,
      logger,
    );

    await expect(handler(MESSAGE)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith('failed to generate reply', {
      message: 'rate limited',
    });
    const call = slackClient.chat.postMessage.mock.calls[0]?.[0] as {
      channel: string;
      text: string;
    };
    expect(call.channel).toBe('D123');
    expect(call.text.length).toBeGreaterThan(0);
  });

  it('logs an error, without throwing, when the generated reply fails to send', async () => {
    const anthropicClient = makeAnthropicClient(REPLY_MESSAGE);
    const slackClient = makeSlackClient({
      ok: false,
      error: 'channel_not_found',
    });
    const logger = makeLogger();
    const handler = createInboundMessageHandler(
      anthropicClient,
      slackClient,
      logger,
    );

    await expect(handler(MESSAGE)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('failed to post reply', {
      message: 'channel_not_found',
    });
  });
});
