import { WebAPIPlatformError } from '@slack/web-api';
import { describe, expect, it, vi } from 'vitest';

import { fetchSlackStatus } from './fetch-slack-status.js';

function makeClient(
  response:
    | {
        readonly ok: boolean;
        readonly error?: string;
        readonly profile?: {
          readonly status_text?: string;
          readonly status_emoji?: string;
        };
      }
    | (() => never),
) {
  return {
    users: {
      profile: {
        get:
          typeof response === 'function'
            ? vi.fn(response)
            : vi.fn().mockResolvedValue(response),
      },
    },
  };
}

describe('fetchSlackStatus', () => {
  it('returns the status text/emoji when Slack accepts the request', async () => {
    const client = makeClient({
      ok: true,
      profile: { status_text: 'On holiday', status_emoji: ':palm_tree:' },
    });

    const result = await fetchSlackStatus(client, 'U123');

    expect(result).toEqual({
      ok: true,
      status: { statusText: 'On holiday', statusEmoji: ':palm_tree:' },
    });
    expect(client.users.profile.get).toHaveBeenCalledWith({ user: 'U123' });
  });

  it('defaults to empty strings when the profile has no status set', async () => {
    const client = makeClient({ ok: true, profile: {} });

    const result = await fetchSlackStatus(client, 'U123');

    expect(result).toEqual({
      ok: true,
      status: { statusText: '', statusEmoji: '' },
    });
  });

  it('returns ok:false with the Slack error when the client resolves ok:false — the general structural-contract case, not real @slack/web-api behavior (see the real-WebAPIPlatformError test below for that)', async () => {
    const client = makeClient({ ok: false, error: 'user_not_found' });

    const result = await fetchSlackStatus(client, 'U123');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'user_not_found' },
    });
  });

  it('returns ok:false when the client throws a generic error (network failure, etc.)', async () => {
    const client = makeClient(() => {
      throw new Error('network unreachable');
    });

    const result = await fetchSlackStatus(client, 'U123');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'slack-api-error', message: 'network unreachable' },
    });
  });

  it('handles a real WebAPIPlatformError the way @slack/web-api actually throws it', async () => {
    const client = makeClient(() => {
      throw new WebAPIPlatformError({ ok: false, error: 'user_not_found' });
    });

    const result = await fetchSlackStatus(client, 'U123');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'slack-api-error',
        message: 'An API error occurred: user_not_found',
      },
    });
  });
});
