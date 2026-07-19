type AddReactionClient = {
  readonly reactions: {
    readonly add: (args: {
      readonly channel: string;
      readonly timestamp: string;
      readonly name: string;
    }) => Promise<{ readonly ok: boolean; readonly error?: string }>;
  };
};

export type AddReactionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'slack-api-error';
        readonly message: string;
      };
    };

/**
 * Thin wrapper over `WebClient.reactions.add` — same shape and same reasoning as `post-message.ts`'s
 * `postMessage`: takes a structural subset of `WebClient`, and the real client always throws a
 * `WebAPIPlatformError` on a Slack-reported error rather than resolving `{ ok: false }` (same SDK
 * behavior verified for `chat.postMessage`; `reactions.add` goes through the identical `apiCall()`
 * path in `@slack/web-api`). Used by BUILD_PLAN 3.4a-iii to seed the 📦/🔁/✅ reaction-gate legend
 * onto a real posted ticket-draft message.
 */
export async function addReaction(
  client: AddReactionClient,
  params: {
    readonly channelId: string;
    readonly messageTs: string;
    readonly reactionName: string;
  },
): Promise<AddReactionResult> {
  try {
    const response = await client.reactions.add({
      channel: params.channelId,
      timestamp: params.messageTs,
      name: params.reactionName,
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
