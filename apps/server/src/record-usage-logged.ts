import type { HandlerDeps } from './handle-inbound-message.js';

import { toUtcDay } from '@moe/core';

import { repositoryErrorMessage } from './repository-error.js';

// A local `Pick`, not the full `HandlerDeps` — same "only require what's actually used" reasoning
// as `check-cost-cap.ts`'s own `CostCapDeps`. Lets a caller outside the message-handling path
// (BUILD_PLAN 3.4a-ii's reaction-outcome actions) reuse this function without needing to also
// supply `historyStore`/`threadQueue`/`channelScopeConfig`/etc., which it has no use for.
type RecordUsageDeps = Pick<HandlerDeps, 'personaId' | 'costStore' | 'logger'>;

/**
 * Accounts for one LLM call's token usage against the persona/day cost bucket (BUILD_PLAN 2.6a) —
 * "log, don't throw" on failure, same as `handle-inbound-message.ts`'s `appendTurnLogged`; a
 * cost-tracking write should never be why a reply doesn't reach Slack (or, for the ambient path,
 * why classification/drafting doesn't complete). Model-agnostic — the caller prices `usage` with
 * whichever model it just called (`sonnetCostUsdMicros` for the DM chat-reply path, the
 * ticket-draft composer and its 🔁 redo regeneration call, and the confirming-question lead-in
 * composer, BUILD_PLAN 5.3a-ii; `haikuCostUsdMicros` for the Stage 1 classifier and the
 * situational-appropriateness gate) and passes the result in, so this function only ever
 * persists, never decides pricing. Deliberately named by call site here rather than by an ordinal
 * count ("a second... a third...") — DA review found that scheme stale twice over, once already
 * missing a real call site before this chunk even landed, since every future addition has to
 * remember to bump a number nothing enforces. Only called after its own LLM call succeeded — a
 * failed API call has no real `usage` to account for. Extracted to its own file (not
 * `handle-inbound-message.ts`) purely to stay under `max-lines` once BUILD_PLAN 3.4a-i's
 * ambient-channel drafting moved into its own file too and both needed this same shared
 * accounting step.
 */
export async function recordUsageLogged(
  deps: RecordUsageDeps,
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
      errorMessage: repositoryErrorMessage(result.error),
    });
  }
}
