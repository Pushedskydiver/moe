import type { InboundReaction } from '@moe/slack';

import { classifyReactionOutcome } from '@moe/slack';

import {
  commitTicketDraft,
  parkTicketDraftToBacklog,
  regenerateTicketDraft,
} from './reaction-outcome-actions.js';
import { repositoryErrorMessage } from './repository-error.js';

type ReactionOutcomeDeps = Parameters<typeof commitTicketDraft>[0];

// BUILD_PLAN 3.4a-ii's own scope, per Alex's confirmed resolution (`AskUserQuestion`): builds the
// real reaction-event handler as a testable primitive — no live Socket Mode `reaction_added`
// listener is registered anywhere (`socket-mode-listener.ts` itself is untouched this chunk;
// `start-slack-listener.ts` DOES gain this chunk's `ticketStore`/`draftStore` construction/wiring
// into `HandlerDeps`, it just never calls this function). 3.4a-i's own draft composition doesn't
// persist a `pending_ticket_draft` row either, so nothing in the real process can produce a
// reaction this handler would ever see — both halves of the real end-to-end loop wait for
// 3.4a-iii's situational-appropriateness gate, per its own BUILD_PLAN text ("wiring it in front of
// 3.4a-i completes the acceptance-test path").
//
// KNOWN GAP for 3.4a-iii to close before wiring `reactions.add`: there is no self-authored-
// reaction filter here, unlike `raw-message-event.ts`'s sibling `isProcessableMessageEvent` (which
// filters `bot_id` specifically — "skipping these is what stops a reply loop," per its own
// comment). Once 3.4a-iii's own `reactions.add` call
// seeds the 📦/🔁/✅ legend onto the persona's own posted draft message, that action itself emits a
// real `reaction_added` event with `user` = the persona's own bot user ID — undetected today, since
// no `botUserId`-equivalent field exists anywhere in `PersonaConfig`/`HandlerDeps` to filter it
// with (confirmed via repo-wide grep, DA review chunk 3.4a-ii). 3.4a-iii needs to thread a bot
// identity value through this pipeline and filter on it before wiring `reactions.add` for real.
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
