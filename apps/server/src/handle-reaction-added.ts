import type { InboundReaction } from '@moe/slack';

import { classifyReactionOutcome } from '@moe/slack';

import {
  commitTicketDraft,
  parkTicketDraftToBacklog,
  regenerateTicketDraft,
} from './reaction-outcome-actions.js';
import { repositoryErrorMessage } from './repository-error.js';

type ReactionOutcomeDeps = Parameters<typeof commitTicketDraft>[0];

// Real, live as of BUILD_PLAN 3.4a-iii: `start-slack-listener.ts` registers a real Socket Mode
// `reaction_added` listener (`createSocketModeListener`'s `onReactionAdded` opt, `@moe/slack`)
// wired to `createReactionHandler` below, and 3.4a-iii's own real draft-posting now persists a
// `pending_ticket_draft` row keyed on the real posted message — both halves of the real end-to-end
// loop chunk 3.4a-ii's own text described are wired together as of this chunk.
//
// The self-authored-reaction filter chunk 3.4a-ii's DA review flagged as a known gap (this
// persona's own `reactions.add` legend-seeding call itself emitting a `reaction_added` event this
// handler would otherwise misdispatch against) is closed one layer up, in `@moe/slack`'s
// `handleSocketModeReactionEvent` — it compares the event's `user` against a `botUserId` fetched
// once at startup (`fetchBotUserId`) and never calls `onReactionAdded` for a self-authored one, so
// this function itself never needs to know about bot identity at all.
export async function handleReactionAdded(
  deps: ReactionOutcomeDeps,
  reaction: InboundReaction,
): Promise<void> {
  const outcome = classifyReactionOutcome(reaction.reactionName);
  if (outcome === undefined) return;

  const found = await deps.draftStore.getByMessage({
    channelId: reaction.channelId,
    messageTs: reaction.messageTs,
  });
  if (!found.ok) {
    deps.logger.error('failed to look up pending ticket draft', {
      message: repositoryErrorMessage(found.error),
    });
    return;
  }
  if (found.draft === null) return;

  // Ignored for every outcome, not just ✅/📦 — a resolved draft's ticket already exists, so a 🔁
  // redo would waste a real Anthropic call regenerating content nothing reads anymore.
  // `commitTicketDraft`/`parkTicketDraftToBacklog`'s own atomic claim (`draftStore.resolve`) is
  // the race-safe backstop for the narrow window between this check and that claim; this check is
  // the common-case fast path and the only guard `regenerateTicketDraft` gets.
  if (found.draft.resolvedAt !== null) {
    deps.logger.info('ignoring reaction on an already-resolved ticket draft', {
      personaId: deps.personaId,
      draftId: found.draft.id,
      outcome,
    });
    return;
  }

  if (outcome === 'commit') {
    await commitTicketDraft(deps, found.draft);
  } else if (outcome === 'park') {
    await parkTicketDraftToBacklog(deps, found.draft);
  } else {
    await regenerateTicketDraft(deps, found.draft);
  }
}

/**
 * Binds `handleReactionAdded` to one persona's deps, same factory shape as
 * `createInboundMessageHandler` — `start-slack-listener.ts` passes the result straight through as
 * `createSocketModeListener`'s `onReactionAdded` opt.
 */
export function createReactionHandler(
  deps: ReactionOutcomeDeps,
): (reaction: InboundReaction) => Promise<void> {
  return (reaction) => handleReactionAdded(deps, reaction);
}
