import type { GithubConfig } from './github-config.js';
import type { AppLogger } from '@moe/core';

import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';

import { createGithubSdkLoggerAdapter } from './create-github-sdk-logger-adapter.js';

/**
 * Single builder for the authenticated Octokit client — never construct Octokit elsewhere
 * (`docs/CONVENTIONS.md`'s External API Integration Patterns: "Reuse header/auth builders").
 * The same redacting adapter is wired at both layers Octokit can log through: the top-level
 * `log` option (request/response logging) and `auth.log` (createAppAuth's own internal
 * cache/token-refresh warnings) — defense-in-depth consistency with `create-slack-clients.ts`'s
 * `createWebClient`, not because either logging surface is confirmed to embed a secret today
 * (checked against `@octokit/auth-app@8.2.0`'s own source: none of its three `log.warn` call
 * sites include a token). The credential that actually matters here — the installation access
 * token minted per-request, unknown at client-construction time — isn't in `secretValues` (only
 * the static `privateKey` is, since the token doesn't exist yet when this runs);
 * `createGithubSdkLoggerAdapter`'s own pattern-based redaction is what covers that one wherever
 * it appears in a log line, independent of whether it was passed in explicitly.
 */
export function createGithubClient(
  config: GithubConfig,
  logger: AppLogger,
): Octokit {
  const logAdapter = createGithubSdkLoggerAdapter(logger, [config.privateKey]);
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      installationId: config.installationId,
      log: logAdapter,
    },
    log: logAdapter,
  });
}
