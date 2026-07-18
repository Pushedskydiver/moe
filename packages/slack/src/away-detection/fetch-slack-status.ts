import { z } from 'zod';

type FetchSlackStatusClient = {
  readonly users: {
    readonly profile: {
      readonly get: (args: { readonly user: string }) => Promise<unknown>;
    };
  };
};

// `docs/CONVENTIONS.md`'s External API Integration Patterns: "Schema-validate all API
// responses" — matches `packages/core/src/core-hours/bank-holidays-client.ts`'s model example.
// The client's own return type above is `unknown`, not a typed shape, precisely so this schema
// is the only thing standing between an unexpected Slack response and `status_text`/
// `status_emoji` reaching `is-away.js`'s matchers unchecked.
const usersProfileGetResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  profile: z
    .object({
      status_text: z.string().optional(),
      status_emoji: z.string().optional(),
    })
    .optional(),
});

export type SlackStatus = {
  readonly statusText: string;
  readonly statusEmoji: string;
};

export type FetchSlackStatusError =
  | { readonly kind: 'slack-api-error'; readonly message: string }
  | { readonly kind: 'invalid-response'; readonly issues: string };

export type FetchSlackStatusResult =
  | { readonly ok: true; readonly status: SlackStatus }
  | { readonly ok: false; readonly error: FetchSlackStatusError };

/**
 * Thin wrapper over `WebClient.users.profile.get` — same structural-subset-client,
 * throws-on-API-error handling as `../post-message.js`'s `postMessage` (verified this transfers:
 * both methods bind through `@slack/web-api`'s identical `apiCall()` path, which always throws
 * `WebAPIPlatformError` on `ok:false`, never resolves it — the `response.ok` branch below exists
 * for the same general structural-contract reason as `postMessage`'s, not because the real SDK
 * uses it). A missing `status_text`/`status_emoji` on the profile (no status currently set)
 * defaults to `''`, not `undefined` — `is-away.js`'s matchers expect plain strings.
 */
export async function fetchSlackStatus(
  client: FetchSlackStatusClient,
  userId: string,
): Promise<FetchSlackStatusResult> {
  try {
    const raw = await client.users.profile.get({ user: userId });
    const parsed = usersProfileGetResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: { kind: 'invalid-response', issues: parsed.error.message },
      };
    }

    const response = parsed.data;
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
