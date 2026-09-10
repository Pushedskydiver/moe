import type { Database } from '@moe/core';
import type { Kysely } from 'kysely';

import {
  claimTicket,
  getTicketBriefByMessage,
  getTicketPlanByMessage,
  releaseTicket,
  transitionTicketStatus,
} from '@moe/core';

// Extracted from `start-slack-listener.ts` purely to stay under eslint's `max-lines` (300,
// skip blanks/comments — `docs/CONVENTIONS.md` §Complexity Limits) once BUILD_PLAN 6.1e added its
// own Plan-approval sibling to BUILD_PLAN 6.1d's original Brief-approval factories below —
// composition code extracts aggressively (`docs/CONVENTIONS.md` §Code Style). Every export here is
// consumed only by `start-slack-listener.ts`'s own `createStores`/`buildReactionHandler`.

// BUILD_PLAN 6.1d — a one-method store, same shape `createDraftStore`/`createConfirmingQuestionStore`
// (`start-slack-listener.ts`) already use for their own `getByMessage` method specifically, just
// without their other CRUD methods those two stores also need.
export function createBriefStore(db: Kysely<Database>) {
  return {
    getByMessage: (scope: Parameters<typeof getTicketBriefByMessage>[1]) =>
      getTicketBriefByMessage(db, scope),
  };
}

// BUILD_PLAN 6.1e — mirrors `createBriefStore` one stage over.
export function createPlanStore(db: Kysely<Database>) {
  return {
    getByMessage: (scope: Parameters<typeof getTicketPlanByMessage>[1]) =>
      getTicketPlanByMessage(db, scope),
  };
}

// BUILD_PLAN 6.1d's own reaction-outcome-only primitives, extracted purely to keep `createStores`
// under eslint's `max-lines-per-function` — bound here (not `HandlerDeps`) since
// `approveBriefAndTransitionToPlan` (wired in `start-slack-listener.ts`'s `buildReactionHandler`) is
// `createReactionHandler`'s only caller. Kept as three separate closures, not one composed
// function, so `approveBriefAndTransitionToPlan`'s own `ApproveBriefDeps` stays generic
// (claim/transition/release, no Brief/Plan-specific knowledge) — the `fromStatus: 'Brief'`/
// `toStatus: 'Plan'` specificity lives entirely here, in the composition root.
export function createBriefApprovalPrimitives(db: Kysely<Database>) {
  return {
    claimTicketForApproval: (id: string, claimedBy: string) =>
      claimTicket(db, id, claimedBy),
    transitionBriefToPlan: (input: {
      readonly id: string;
      readonly projectKey: string;
      readonly claimedBy: string;
    }) =>
      transitionTicketStatus(db, {
        ...input,
        fromStatus: 'Brief',
        toStatus: 'Plan',
      }),
    releaseTicketAfterApproval: (id: string, claimedBy: string) =>
      releaseTicket(db, id, claimedBy),
  };
}

// BUILD_PLAN 6.1e's own reaction-outcome-only primitives, mirroring `createBriefApprovalPrimitives`
// one stage over — **names deliberately distinct from the Brief versions**, since both sets get
// spread into the same `createStores` return object (`start-slack-listener.ts`) and a name
// collision would silently drop one binding.
export function createPlanApprovalPrimitives(db: Kysely<Database>) {
  return {
    claimTicketForPlanApproval: (id: string, claimedBy: string) =>
      claimTicket(db, id, claimedBy),
    transitionPlanToBuild: (input: {
      readonly id: string;
      readonly projectKey: string;
      readonly claimedBy: string;
    }) =>
      transitionTicketStatus(db, {
        ...input,
        fromStatus: 'Plan',
        toStatus: 'Build',
      }),
    releaseTicketAfterPlanApproval: (id: string, claimedBy: string) =>
      releaseTicket(db, id, claimedBy),
  };
}
