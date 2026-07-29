import type { HandlerDeps } from './handle-inbound-message.js';
import type { TicketDraft } from '@moe/agents';

import {
  composeTicketDraft,
  resolvePersonaModel,
  sonnetCostUsdMicros,
} from '@moe/agents';

import { recordUsageLogged } from './record-usage-logged.js';

// Narrowed to just the `composeTicketDraft` client shape, same "only require what's actually
// used" reasoning as `reaction-outcome-actions.ts`'s own identically-named local alias.
type ComposeDraftClient = Parameters<typeof composeTicketDraft>[0];

export type ComposeTicketDraftAndRecordUsageDeps = Omit<
  Pick<HandlerDeps, 'anthropicClient' | 'personaId' | 'costStore' | 'logger'>,
  'anthropicClient'
> & { readonly anthropicClient: ComposeDraftClient };

/**
 * Shared by both real callers of `composeTicketDraft` that need cost accounting alongside it —
 * `handle-ambient-channel-message.ts`'s own draft composition and `reaction-outcome-actions.ts`'s
 * 🔁 redo/regeneration path — a genuine 2+ consumer case, not a speculative extraction
 * (`docs/CONVENTIONS.md`'s `shared/` folder rule). Resolves the persona's own model
 * (`resolvePersonaModel`, BUILD_PLAN 5.3a) rather than each caller doing it inline, and records
 * usage on success (`recordUsageLogged`, `sonnetCostUsdMicros`). Returns `undefined` on failure,
 * already logged under the caller-supplied `failureLogMessage` — the two callers used slightly
 * different wording ("failed to compose ticket draft" vs. "failed to regenerate ticket draft")
 * before this fold, and there's no reason to force one on the other.
 */
export async function composeTicketDraftAndRecordUsage(
  deps: ComposeTicketDraftAndRecordUsageDeps,
  input: {
    readonly text: string;
    readonly now: Date;
    readonly failureLogMessage: string;
  },
): Promise<TicketDraft | undefined> {
  const composed = await composeTicketDraft(deps.anthropicClient, {
    text: input.text,
    model: resolvePersonaModel(deps.personaId),
  });
  if (!composed.ok) {
    deps.logger.error(input.failureLogMessage, {
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

  return { title: composed.title, body: composed.body };
}
