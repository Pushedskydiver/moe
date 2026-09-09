import type { Logger } from './logger.js';
import type { ClaimError, ClaimResult, TransitionResult } from '@moe/core';

/**
 * A `workAndRelease`-shaped orchestration, mirroring `approve-brief-via-reaction.ts`'s own
 * `approveBriefAndTransitionToPlan` exactly, one stage over — see that function's own TSDoc for the
 * full `workAndRelease`/`pull-loop.ts` reasoning, unchanged here.
 */
export type ApprovePlanDeps = {
  readonly claimTicket: (id: string, claimedBy: string) => Promise<ClaimResult>;
  readonly transitionTicket: (input: {
    readonly id: string;
    readonly projectKey: string;
    readonly claimedBy: string;
  }) => Promise<TransitionResult>;
  readonly releaseTicket: (
    id: string,
    claimedBy: string,
  ) => Promise<ClaimResult>;
  readonly logger: Logger;
};

export type ApprovePlanResult =
  | TransitionResult
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'claim-failed';
        readonly claimError: ClaimError;
      };
    };

/**
 * Claims the (by-then-unclaimed) ticket under the reacting persona's own id, attempts the
 * Plan→Build transition, then always releases — regardless of the transition's outcome — mirroring
 * `approveBriefAndTransitionToPlan` exactly (BUILD_PLAN 6.1e, Plan→Build one stage over). A failed
 * claim (the expected outcome for every persona process except whichever one's reaction-event
 * delivery won the race, when up to 8 processes may all be members of `#moe-team` and all receive
 * the same event) short-circuits before any transition attempt and needs no release, since nothing
 * was claimed.
 */
export async function approvePlanAndTransitionToBuild(
  deps: ApprovePlanDeps,
  input: {
    readonly ticketId: string;
    readonly projectKey: string;
    readonly claimedBy: string;
  },
): Promise<ApprovePlanResult> {
  const claimed = await deps.claimTicket(input.ticketId, input.claimedBy);
  if (!claimed.ok) {
    return {
      ok: false,
      error: { kind: 'claim-failed', claimError: claimed.error },
    };
  }

  // Same `.then(ok, err)` throw-safety guard `approveBriefAndTransitionToPlan`'s own DA review
  // added — built in from the start here rather than needing a second review round to catch it
  // again. Without it, a rejecting `transitionTicket` would skip `releaseTicket` entirely and leak
  // an unreleased claim.
  const result = await deps
    .transitionTicket({
      id: input.ticketId,
      projectKey: input.projectKey,
      claimedBy: input.claimedBy,
    })
    .then(
      (r): TransitionResult => r,
      (cause: unknown): TransitionResult => ({
        ok: false,
        error: { kind: 'unknown', cause },
      }),
    );

  const released = await deps.releaseTicket(input.ticketId, input.claimedBy);
  if (!released.ok) {
    deps.logger.error(
      'failed to release ticket after reaction-triggered plan approval',
      { ticketId: input.ticketId, claimedBy: input.claimedBy },
    );
  }

  return result;
}
