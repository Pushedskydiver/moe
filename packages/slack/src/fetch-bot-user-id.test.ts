import { WebAPIPlatformError } from '@slack/web-api';
import { describe, expect, it, vi } from 'vitest';

import { fetchBotUserId } from './fetch-bot-user-id.js';

function makeClient(
  response:
    | {
        readonly ok: boolean;
        readonly error?: string;
        readonly user_id?: string;
      }
    | (() => never),
) {
  return {
    auth: {
      test:
        typeof response === 'function'
          ? vi.fn(response)
          : vi.fn().mockResolvedValue(response),
    },
  };
}

describe('fetchBotUserId', () => {
  it('returns ok:true with the bot user id when auth.test succeeds', async () => {
    const client = makeClient({ ok: true, user_id: 'UBOTSARAH' });

    const result = await fetchBotUserId(client);

    expect(result).toEqual({ ok: true, botUserId: 'UBOTSARAH' });
    expect(client.auth.test).toHaveBeenCalledWith();
  });

  it('returns ok:false when the client resolves ok:true with no user_id — a malformed test-double case, since the real Slack API always includes it on success', async () => {
    const client = makeClient({ ok: true });

    const result = await fetchBotUserId(client);

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'slack-api-error',
        message: 'auth.test response had no user_id',
      },
    });
  });

  it('returns ok:false with the Slack error when the client resolves ok:false — the general structural-contract case, not real @slack/web-api behavior (see the real-WebAPIPlatformError test below for that)', async () => {
    const client = makeClient({ ok: false, error: 'invalid_auth' });

    const result = await fetchBotUserId(client);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'invalid_auth' },
    });
  });

  it('returns ok:false when the client throws a generic error (network failure, etc.)', async () => {
    const client = makeClient(() => {
      throw new Error('network unreachable');
    });

    const result = await fetchBotUserId(client);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'network unreachable' },
    });
  });

  it('handles a real WebAPIPlatformError the way @slack/web-api actually throws it — same apiCall() mechanism as chat.postMessage (verified against its source, post-message.ts), auth.test never resolves ok:false, it always throws', async () => {
    const client = makeClient(() => {
      throw new WebAPIPlatformError({ ok: false, error: 'invalid_auth' });
    });

    const result = await fetchBotUserId(client);

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'slack-api-error',
        message: 'An API error occurred: invalid_auth',
      },
    });
  });
});
