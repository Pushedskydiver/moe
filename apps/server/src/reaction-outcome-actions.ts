import type { HandlerDeps } from './handle-inbound-message.js';
import type { PendingTicketDraft } from '@moe/core';

import { composeTicketDraft, sonnetCostUsdMicros } from '@moe/agents';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { recordUsageLogged } from './record-usage-logged.js';
import { repositoryErrorMessage } from './repository-error.js';

// Narrowed to just the `composeTicketDraft` client shape, not `HandlerDeps['anthropicClient']`'s
// full `GenerateReplyClient & ClassifierClient & ComposeDraftClient` intersection — this file
// never calls `generateReply`/`classifyMessageConfidence`, so a caller (or a test) shouldn't need
// to also satisfy those clients' `messages.create` shape just to supply this one.
type ComposeDraftClient = Parameters<typeof composeTicketDraft>[0];

type ReactionOutcomeDeps = Omit<
  Pick<
    HandlerDeps,
    | 'anthropicClient'
    | 'ticketStore'
    | 'draftStore'
    | 'costStore'
    | 'capStore'
    | 'costCapConfig'
    | 'personaId'
    | 'slackClient'
    | 'logger'
  >,
  'anthropicClient'
> & {
  readonly anthropicClient: ComposeDraftClient;
};

// VISION §3.4's single-project scope ("Single-project today (chief-clancy)", `project-key.ts`'s
// own TSDoc) — not an open parameter this chunk needed to resolve.
const PROJECT_KEY = 'chief-clancy';

// VISION §5.4's trust-erosion rule keeps severity assignment off the LLM layer, same reasoning
// that already keeps `composeTicketDraft` from producing one — Alex confirmed via
// `AskUserQuestion`: every auto-drafted ticket gets this fixed placeholder until a real triage
// signal exists (Stage 4+ GitHub/board integration, or a human editing it after creation).
const DEFAULT_SEVERITY = 'Medium';

/**
 * The ✅/📦 outcomes share everything except the resulting board status — factored out rather than
 * duplicated. Atomically claims the draft first (`draftStore.resolve`'s CAS): a reaction landing on
 * an already-resolved draft (a genuine double-fire, or two reactions racing) is logged and ignored,
 * not treated as an error — exactly the double-processing guard `resolvePendingTicketDraft`'s own
 * TSDoc describes.
 */
async function commitAsTicket(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
  status: 'Backlog' | 'Brief',
): Promise<void> {
  const claimed = await deps.draftStore.resolve(draft.id);
  if (!claimed.ok) {
    deps.logger.info('ticket draft already resolved — ignoring reaction', {
      personaId: deps.personaId,
      draftId: draft.id,
    });
    return;
  }

  const created = await deps.ticketStore.create({
    projectKey: PROJECT_KEY,
    title: draft.draftTitle,
    status,
    severity: DEFAULT_SEVERITY,
  });
  if (!created.ok) {
    deps.logger.error('failed to create ticket from draft', {
      message: repositoryErrorMessage(created.error),
    });
    return;
  }

  deps.logger.info('committed ticket draft', {
    personaId: deps.personaId,
    draftId: draft.id,
    ticketId: created.ticket.id,
    status,
  });
}

/**
 * BUILD_PLAN 3.4a-ii's ✅ outcome: commits the draft as a real, triaged ticket (`Brief`, the board
 * status past `Backlog`'s "untriaged" meaning — VISION §3.3's lifecycle, `Backlog → Brief → ...`).
 */
export async function commitTicketDraft(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
): Promise<void> {
  await commitAsTicket(deps, draft, 'Brief');
}

/**
 * BUILD_PLAN 3.4a-ii's 📦 outcome: parks the draft as an untriaged `Backlog` ticket, per BUILD_PLAN
 * 3.4a-i's own reaction-legend wording ("park it to Backlog untriaged").
 */
export async function parkTicketDraftToBacklog(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
): Promise<void> {
  await commitAsTicket(deps, draft, 'Backlog');
}

/**
 * BUILD_PLAN 3.4a-ii's 🔁 outcome: recomposes a fresh draft from the *original* source message
 * (not the previous draft's own title/body, which may itself be why the user asked for a redo),
 * then overwrites the pending draft's content in place — not a terminal claim
 * (`draftStore.updateContent`, not `.resolve`), since regeneration leaves the draft open for a
 * further reaction. A real, billed Anthropic call like every other call site in this cascade: its
 * own fresh `checkCostCapAndAlert` check (not a stale one from whichever step dispatched here) and
 * `sonnetCostUsdMicros` accounting via `recordUsageLogged`.
 */
export async function regenerateTicketDraft(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
): Promise<void> {
  const now = new Date();
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info(
      'skipping ticket-draft regeneration — monthly cost cap reached',
      { personaId: deps.personaId, draftId: draft.id },
    );
    return;
  }

  const recomposed = await composeTicketDraft(deps.anthropicClient, {
    text: draft.sourceMessageText,
  });
  if (!recomposed.ok) {
    deps.logger.error('failed to regenerate ticket draft', {
      message: recomposed.error.message,
    });
    return;
  }

  await recordUsageLogged(
    deps,
    {
      usage: recomposed.usage,
      costUsdMicros: sonnetCostUsdMicros(recomposed.usage, now),
    },
    now,
  );

  const updated = await deps.draftStore.updateContent(draft.id, {
    draftTitle: recomposed.title,
    draftBody: recomposed.body,
  });
  if (!updated.ok) {
    deps.logger.error('failed to persist regenerated ticket draft', {
      message: repositoryErrorMessage(updated.error),
    });
    return;
  }

  deps.logger.info('regenerated ticket draft', {
    personaId: deps.personaId,
    draftId: draft.id,
    draftTitle: updated.draft.draftTitle,
    draftBody: updated.draft.draftBody,
  });
}
