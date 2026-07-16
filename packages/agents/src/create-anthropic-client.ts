import { Anthropic } from '@anthropic-ai/sdk';

// The SDK defaults to a 10-minute timeout (built for long agentic/batch calls) and to a request
// being retried on timeout, so a worst case with the default could stall far past any chat-turn
// budget. VISION §6.4's sub-10s casual-reply latency target isn't enforced by this number alone,
// but 10 minutes is clearly the wrong shape for a live Slack reply — 20s per attempt leaves real
// headroom for a genuine completion while still failing fast enough to matter. Revisit with real
// latency data once 2.6a's cost/latency metering lands.
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Single builder for the Anthropic Messages API client — never construct `Anthropic` elsewhere
 * (same "one builder" convention as `createWebClient`/`createSocketModeClient` in `@moe/slack`).
 */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}
