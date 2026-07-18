import type { HandlerDeps } from './handle-inbound-message.js';

import { toUtcDay } from '@moe/core';

import { repositoryErrorMessage } from './repository-error.js';

/**
 * Accounts for one LLM call's token usage against the persona/day cost bucket (BUILD_PLAN 2.6a,
 * extended at 3.3 to a second model/call site, and 3.4a-i to a third) — "log, don't throw" on
 * failure, same as `handle-inbound-message.ts`'s `appendTurnLogged`; a cost-tracking write should
 * never be why a reply doesn't reach Slack (or, for the ambient path, why classification/drafting
 * doesn't complete). Model-agnostic — the caller prices `usage` with whichever model it just
 * called (`sonnetCostUsdMicros` for the DM chat-reply path and the ticket-draft composer,
 * `haikuCostUsdMicros` for the Stage 1 classifier) and passes the result in, so this function only
 * ever persists, never decides pricing. Only called after its own LLM call succeeded — a failed
 * API call has no real `usage` to account for. Extracted to its own file (not `handle-inbound-
 * message.ts`) purely to stay under `max-lines` once BUILD_PLAN 3.4a-i's ambient-channel drafting
 * moved into its own file too and both needed this same shared accounting step.
 */
export async function recordUsageLogged(
  deps: HandlerDeps,
  input: {
    readonly usage: {
      readonly inputTokens: number;
      readonly outputTokens: number;
    };
    readonly costUsdMicros: number;
  },
  now: Date,
): Promise<void> {
  const result = await deps.costStore.recordUsage({
    personaId: deps.personaId,
    day: toUtcDay(now.toISOString()),
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    costUsdMicros: input.costUsdMicros,
  });
  if (!result.ok) {
    deps.logger.error('failed to record LLM cost usage', {
      message: repositoryErrorMessage(result.error),
    });
  }
}
