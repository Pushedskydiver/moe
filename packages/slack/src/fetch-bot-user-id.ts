type AuthTestClient = {
  readonly auth: {
    readonly test: () => Promise<{
      readonly ok: boolean;
      readonly error?: string;
      readonly user_id?: string;
    }>;
  };
};

export type FetchBotUserIdResult =
  | { readonly ok: true; readonly botUserId: string }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'slack-api-error';
        readonly message: string;
      };
    };

/**
 * Thin wrapper over `WebClient.auth.test` — same structural-subset-injection, try/catch, and
 * missing-required-field shape as `post-message.ts`'s `postMessage` (see its own TSDoc for why:
 * the real `WebClient` always throws a `WebAPIPlatformError` on a Slack-reported API error via the
 * same shared `apiCall()` mechanism every generated method uses, so `response.ok` and the
 * `user_id` presence check below only ever fire against a malformed test double, never real
 * `@slack/web-api`). BUILD_PLAN 3.4a-iii's own self-authored-reaction filter needs this persona's
 * bot user id, fetched once at process startup (`start-slack-listener.ts`) — Slack's
 * `reaction_added` event has no separate `bot_id`-style marker the way its `message` event does
 * (`raw-message-event.ts`'s own `bot_id` filter), since the actor of a reaction is always
 * identified by a plain user id, including for a bot's own workspace user identity.
 */
export async function fetchBotUserId(
  client: AuthTestClient,
): Promise<FetchBotUserIdResult> {
  try {
    const response = await client.auth.test();
    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: 'slack-api-error',
          message: response.error ?? 'unknown error',
        },
      };
    }
    if (response.user_id === undefined) {
      return {
        ok: false,
        error: {
          kind: 'slack-api-error',
          message: 'auth.test response had no user_id',
        },
      };
    }
    return { ok: true, botUserId: response.user_id };
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
