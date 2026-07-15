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
 * the class itself) so callers can inject a plain test double. `@slack/web-api` can both reject
 * (network/rate-limit) and resolve with `{ ok: false }` (a Slack-reported API error); both collapse
 * into the same Result-shaped error channel.
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
