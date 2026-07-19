import { WebAPIPlatformError } from '@slack/web-api';
import { describe, expect, it, vi } from 'vitest';

import { addReaction } from './add-reaction.js';

function makeClient(
  response: { readonly ok: boolean; readonly error?: string } | (() => never),
) {
  return {
    reactions: {
      add:
        typeof response === 'function'
          ? vi.fn(response)
          : vi.fn().mockResolvedValue(response),
    },
  };
}

describe('addReaction', () => {
  it('returns ok:true and passes channel/timestamp/name through when Slack accepts the reaction', async () => {
    const client = makeClient({ ok: true });

    const result = await addReaction(client, {
      channelId: 'C123',
      messageTs: '1700000000.000100',
      reactionName: 'white_check_mark',
    });

    expect(result).toEqual({ ok: true });
    expect(client.reactions.add).toHaveBeenCalledWith({
      channel: 'C123',
      timestamp: '1700000000.000100',
      name: 'white_check_mark',
    });
  });

  it('returns ok:false with the Slack error when the client resolves ok:false — the general structural-contract case, not real @slack/web-api behavior', async () => {
    const client = makeClient({ ok: false, error: 'message_not_found' });

    const result = await addReaction(client, {
      channelId: 'C123',
      messageTs: '1700000000.000100',
      reactionName: 'white_check_mark',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'message_not_found' },
    });
  });

  it('returns ok:false when the client throws a generic error (network failure, etc.)', async () => {
    const client = makeClient(() => {
      throw new Error('network unreachable');
    });

    const result = await addReaction(client, {
      channelId: 'C123',
      messageTs: '1700000000.000100',
      reactionName: 'white_check_mark',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'network unreachable' },
    });
  });

  it('handles a real WebAPIPlatformError the way @slack/web-api actually throws it — reactions.add never resolves ok:false, it always throws, same as chat.postMessage', async () => {
    const client = makeClient(() => {
      throw new WebAPIPlatformError({ ok: false, error: 'already_reacted' });
    });

    const result = await addReaction(client, {
      channelId: 'C123',
      messageTs: '1700000000.000100',
      reactionName: 'white_check_mark',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'slack-api-error',
        message: 'An API error occurred: already_reacted',
      },
    });
  });
});
