import { describe, expect, it, vi } from 'vitest';

import { postMessage } from './post-message.js';

function makeClient(
  response: { readonly ok: boolean; readonly error?: string } | (() => never),
) {
  return {
    chat: {
      postMessage:
        typeof response === 'function'
          ? vi.fn(response)
          : vi.fn().mockResolvedValue(response),
    },
  };
}

describe('postMessage', () => {
  it('returns ok:true and passes channel/text through when Slack accepts the message', async () => {
    const client = makeClient({ ok: true });

    const result = await postMessage(client, { channelId: 'C123', text: 'hi' });

    expect(result).toEqual({ ok: true });
    expect(client.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C123',
      text: 'hi',
    });
  });

  it('passes thread_ts through when replying in a thread', async () => {
    const client = makeClient({ ok: true });

    await postMessage(client, {
      channelId: 'C123',
      text: 'hi',
      threadTs: '1700.0001',
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C123',
      text: 'hi',
      thread_ts: '1700.0001',
    });
  });

  it('returns ok:false with the Slack error when the API reports ok:false', async () => {
    const client = makeClient({ ok: false, error: 'channel_not_found' });

    const result = await postMessage(client, { channelId: 'C123', text: 'hi' });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'channel_not_found' },
    });
  });

  it('returns ok:false when the client throws (rate limit, network error, etc.)', async () => {
    const client = makeClient(() => {
      throw new Error('rate_limited');
    });

    const result = await postMessage(client, { channelId: 'C123', text: 'hi' });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'rate_limited' },
    });
  });
});
