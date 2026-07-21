import type { GithubConfig } from './github-config.js';

import { createAppAuth } from '@octokit/auth-app';

export type ValidateGithubCredentialsResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-credentials';
        readonly message: string;
      };
    };

/**
 * Boot-time guard (BUILD_PLAN 4.1's "v2 outage lesson": a truncated/empty secret previously took
 * the live service down — `docs/GIT.md`'s deploy-safety note) — exercises the real
 * appId/privateKey/installationId chain via a live installation-token exchange, mirroring
 * `apps/server/src/start-slack-listener.ts`'s own `fetchBotUserId`/`auth.test` boot-time
 * credential check rather than a local-only format check: a malformed/truncated/empty key fails
 * this exchange the same way it would fail JWT signing alone, and this also catches a wrong or
 * revoked installation id, which a key-format-only check can't. Builds its own lightweight
 * `createAppAuth` strategy directly rather than a full `createGithubClient` — no Octokit request
 * plumbing is needed just to prove the credential chain works.
 */
export async function validateGithubCredentials(
  config: GithubConfig,
): Promise<ValidateGithubCredentialsResult> {
  const auth = createAppAuth({
    appId: config.appId,
    privateKey: config.privateKey,
    installationId: config.installationId,
  });

  try {
    await auth({ type: 'installation' });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'invalid-credentials',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
