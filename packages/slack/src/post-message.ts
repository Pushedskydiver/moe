type PostMessageClient = {
  readonly chat: {
    readonly postMessage: (args: {
      readonly channel: string;
      readonly text: string;
      readonly thread_ts?: string;
    }) => Promise<{
      readonly ok: boolean;
      readonly error?: string;
      readonly ts?: string;
    }>;
  };
};

export type PostMessageResult =
  | { readonly ok: true; readonly ts: string }
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
 * `ts` (the new message's own timestamp, distinct from any `threadTs` passed in) is required on
 * success, added for BUILD_PLAN 3.4a-iii's ticket-draft posting — it needs the posted message's
 * own identity to persist a `pending_ticket_drafts` row and seed reactions against it. A response
 * that resolves `ok: true` with no `ts` is treated as a failure, same as a missing required field
 * anywhere else in this codebase (e.g. a classifier's `parsed_output: null`) — the real Slack API
 * always includes it on success, so this only fires against a malformed test double.
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
    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: 'slack-api-error',
          message: response.error ?? 'unknown error',
        },
      };
    }
    if (response.ts === undefined) {
      return {
        ok: false,
        error: {
          kind: 'slack-api-error',
          message: 'chat.postMessage response had no ts',
        },
      };
    }
    return { ok: true, ts: response.ts };
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
