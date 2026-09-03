import type { HandlerDeps } from './handle-inbound-message.js';
import type { Brief } from '@moe/agents';

import {
  composeBrief,
  fetchPersonaPromptContent,
  resolvePersonaModel,
  sonnetCostUsdMicros,
} from '@moe/agents';

import { recordUsageLogged } from './record-usage-logged.js';

// Narrowed to just the `composeBrief` client shape, same "only require what's actually used"
// reasoning as `compose-ticket-draft-and-record-usage.ts`'s own identically-shaped
// `ComposeDraftClient`.
type ComposeBriefClient = Parameters<typeof composeBrief>[0];

export type ComposeBriefAndRecordUsageDeps = Pick<
  HandlerDeps,
  'personaId' | 'costStore' | 'logger'
> & { readonly anthropicClient: ComposeBriefClient };

const FAILURE_LOG_MESSAGE = 'failed to compose brief';

/**
 * BUILD_PLAN 6.1b's own brief-composition-plus-cost-accounting wrapper — mirrors
 * `compose-ticket-draft-and-record-usage.ts`'s `composeTicketDraftAndRecordUsage` exactly:
 * resolves the persona's own model (`resolvePersonaModel`) and voice
 * (`fetchPersonaPromptContent`), calls `composeBrief`, and records usage on success
 * (`recordUsageLogged`, `sonnetCostUsdMicros`). Unlike that sibling, this has exactly one real
 * caller (`handle-brief-stage-ticket.ts`), so the failure log message is a fixed constant here
 * rather than a caller-supplied parameter — there's no second wording to reconcile.
 */
export async function composeBriefAndRecordUsage(
  deps: ComposeBriefAndRecordUsageDeps,
  input: {
    readonly title: string;
    readonly body?: string;
    readonly now: Date;
  },
): Promise<Brief | undefined> {
  const composed = await composeBrief(deps.anthropicClient, {
    title: input.title,
    body: input.body,
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

  return { summary: composed.summary, scope: composed.scope };
}
