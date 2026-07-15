type PostMessageClient = {
  readonly chat: {
    readonly postMessage: (args: {
      readonly channel: string;
      readonly text: string;
      readonly thread_ts?: string;
    }) => Promise<{ readonly ok: boolean; readonly error?: string }>;
  };
};

export type PostMessageResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'slack-api-error';
        readonly message: string;
      };
    };

/**
 * Thin wrapper over `WebClient.chat.postMessage` — takes a structural subset of `WebClient` (not
 * the class itself) so callers can inject a plain test double. The real `WebClient` always throws
 * a `WebAPIPlatformError` on a Slack-reported API error (verified against `@slack/web-api`'s own
 * `apiCall()` — it never resolves with `{ ok: false }`), so in production every error flows
 * through the `catch` branch below with the SDK's own `"An API error occurred: <code>"` message.
 * The `response.ok` check exists for `PostMessageClient`'s general structural contract (a test
 * double or future client isn't required to always throw), not because `@slack/web-api` uses it.
 */
export async function postMessage(
  client: PostMessageClient,
  params: {
    readonly channelId: string;
    readonly text: string;
    readonly threadTs?: string;
  },
): Promise<PostMessageResult> {
  try {
    const response = await client.chat.postMessage({
      channel: params.channelId,
      text: params.text,
      ...(params.threadTs !== undefined ? { thread_ts: params.threadTs } : {}),
    });
    return response.ok
      ? { ok: true }
      : {
          ok: false,
          error: {
            kind: 'slack-api-error',
            message: response.error ?? 'unknown error',
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
