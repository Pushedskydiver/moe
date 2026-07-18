type FetchSlackStatusClient = {
  readonly users: {
    readonly profile: {
      readonly get: (args: { readonly user: string }) => Promise<{
        readonly ok: boolean;
        readonly error?: string;
        readonly profile?: {
          readonly status_text?: string;
          readonly status_emoji?: string;
        };
      }>;
    };
  };
};

export type SlackStatus = {
  readonly statusText: string;
  readonly statusEmoji: string;
};

export type FetchSlackStatusResult =
  | { readonly ok: true; readonly status: SlackStatus }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'slack-api-error';
        readonly message: string;
      };
    };

/**
 * Thin wrapper over `WebClient.users.profile.get` — same structural-subset-client,
 * throws-on-API-error handling as `../post-message.js`'s `postMessage` (that file's own TSDoc
 * documents the verified real `@slack/web-api` throw behavior; the `response.ok` branch here
 * exists for the same general structural-contract reason, not because the real SDK uses it).
 * A missing `status_text`/`status_emoji` on the profile (no status currently set) defaults to
 * `''`, not `undefined` — `is-away.js`'s matchers expect plain strings.
 */
export async function fetchSlackStatus(
  client: FetchSlackStatusClient,
  userId: string,
): Promise<FetchSlackStatusResult> {
  try {
    const response = await client.users.profile.get({ user: userId });
    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: 'slack-api-error',
          message: response.error ?? 'unknown error',
        },
      };
    }
    return {
      ok: true,
      status: {
        statusText: response.profile?.status_text ?? '',
        statusEmoji: response.profile?.status_emoji ?? '',
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'slack-api-error',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
