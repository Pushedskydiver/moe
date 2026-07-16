import { Anthropic } from '@anthropic-ai/sdk';

import { createAnthropicSdkLoggerAdapter } from './create-anthropic-sdk-logger-adapter.js';

// The SDK defaults to a 10-minute timeout (built for long agentic/batch calls) and to a request
// being retried on timeout, so a worst case with the default could stall far past any chat-turn
// budget. VISION §11's sub-10s casual-reply latency target isn't enforced by this number alone,
// but 10 minutes is clearly the wrong shape for a live Slack reply — 20s per attempt leaves real
// headroom for a genuine completion while still failing fast enough to matter. 2.6a adds token/
// cost metering, not latency tracking (BUILD_PLAN.md) — revisit this number once there's real
// latency data from *some* source, not tied to a specific chunk.
const REQUEST_TIMEOUT_MS = 20_000;

type AppLogger = {
  readonly info: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly warn: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly error: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

/**
 * Single builder for the Anthropic Messages API client — never construct `Anthropic` elsewhere
 * (same "one builder" convention as `createWebClient`/`createSocketModeClient` in `@moe/slack`).
 * Routes the SDK's own internal logging through the given logger (see
 * `createAnthropicSdkLoggerAdapter`) so it can't bypass redaction via the SDK's own default
 * `console` logger — the same gap `@moe/slack`'s client builders already close. Every new
 * secret-handling SDK client this repo has added has needed this same wiring; it's easy to skip
 * on the next one too, so it's called out explicitly here rather than assumed obvious.
 */
export function createAnthropicClient(
  apiKey: string,
  logger: AppLogger,
): Anthropic {
  return new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    logger: createAnthropicSdkLoggerAdapter(logger, [apiKey]),
  });
}
