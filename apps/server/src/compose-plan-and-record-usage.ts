import type { HandlerDeps } from './handle-inbound-message.js';
import type { Plan } from '@moe/agents';

import {
  composePlan,
  fetchPersonaPromptContent,
  resolvePersonaModel,
  sonnetCostUsdMicros,
} from '@moe/agents';

import { recordUsageLogged } from './record-usage-logged.js';

// Narrowed to just the `composePlan` client shape, same "only require what's actually used"
// reasoning as `compose-brief-and-record-usage.ts`'s own identically-shaped `ComposeBriefClient`.
type ComposePlanClient = Parameters<typeof composePlan>[0];

export type ComposePlanAndRecordUsageDeps = Pick<
  HandlerDeps,
  'personaId' | 'costStore' | 'logger'
> & { readonly anthropicClient: ComposePlanClient };

const FAILURE_LOG_MESSAGE = 'failed to compose plan';

/**
 * BUILD_PLAN 6.1c's own plan-composition-plus-cost-accounting wrapper — mirrors
 * `compose-brief-and-record-usage.ts`'s `composeBriefAndRecordUsage` exactly: resolves the
 * persona's own model (`resolvePersonaModel`) and voice (`fetchPersonaPromptContent`), calls
 * `composePlan`, and records usage on success (`recordUsageLogged`, `sonnetCostUsdMicros`). Same as
 * that sibling (not "unlike" it — `compose-brief-and-record-usage.ts` also has exactly one real
 * caller and a fixed failure-log constant), this has exactly one real caller
 * (`handle-plan-stage-ticket.ts`), so the failure log message is a fixed constant here too, unlike
 * `compose-ticket-draft-and-record-usage.ts`'s own `composeTicketDraftAndRecordUsage`, which
 * genuinely does take a caller-supplied `failureLogMessage` because it has two real callers
 * (`handle-ambient-channel-message.ts`, `reaction-outcome-actions.ts`) that historically used
 * different wording — there's no second wording to reconcile here either way.
 */
export async function composePlanAndRecordUsage(
  deps: ComposePlanAndRecordUsageDeps,
  input: {
    readonly title: string;
    readonly briefSummary: string;
    readonly briefScope: readonly string[];
    readonly now: Date;
  },
): Promise<Plan | undefined> {
  const composed = await composePlan(deps.anthropicClient, {
    title: input.title,
    briefSummary: input.briefSummary,
    briefScope: input.briefScope,
    model: resolvePersonaModel(deps.personaId),
    personaPromptContent: await fetchPersonaPromptContent(
      deps.personaId,
      deps.logger,
    ),
  });
  if (!composed.ok) {
    deps.logger.error(FAILURE_LOG_MESSAGE, {
      errorMessage: composed.error.message,
    });
    return undefined;
  }

  await recordUsageLogged(
    deps,
    {
      usage: composed.usage,
      costUsdMicros: sonnetCostUsdMicros(composed.usage, input.now),
    },
    input.now,
  );

  return {
    approach: composed.approach,
    confidence: composed.confidence,
    alternativesConsidered: composed.alternativesConsidered,
    openQuestions: composed.openQuestions,
  };
}
