import type { Logger } from './logger.js';
import type { ClaimError, ClaimResult, TransitionResult } from '@moe/core';

/**
 * A `workAndRelease`-shaped orchestration, **not** a new `packages/core` transactional primitive —
 * `transitionTicketStatus`'s own TSDoc already documents that it is deliberately *not*
 * transaction-wrapped with claim/release, matching the pull loop's existing multi-round-trip,
 * release-always-attempted, release-failure-is-a-logged-warning-not-a-fatal pattern
 * (`apps/server/src/pull-loop.ts`'s own `workAndRelease`). This is that same pattern applied to one
 * reaction-triggered call instead of one pull-loop tick.
 */
export type ApproveBriefDeps = {
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

export type ApproveBriefResult =
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
 * Brief→Plan transition, then always releases — regardless of the transition's outcome — mirroring
 * `pull-loop.ts`'s `workAndRelease` exactly. A failed claim (the expected outcome for every
 * persona process except whichever one's reaction-event delivery won the race, when up to 8
 * processes may all be members of `#moe-team` and all receive the same event) short-circuits
 * before any transition attempt and needs no release, since nothing was claimed.
 *
 * **R1 fix (M2), corrected at R2:** the original `ClaimError` is preserved on the `claim-failed`
 * variant, not flattened — `runPullLoopTick` (`pull-loop.ts:225-235`), the pattern this function
 * partly mirrors, itself branches on `claimed.error.kind === 'unavailable'` (a benign lost race,
 * returned as `claim-lost-race` — this path is NOT logged at any level in the pull loop today) vs.
 * anything else (`'validation-failed'`/`'unknown'`, a real DB problem, logged as an error).
 * Flattening `claimTicket`'s failure to one undifferentiated `claim-failed` kind would make that
 * distinction impossible for the caller to reproduce, silently downgrading a genuine failure to
 * routine race noise — this fix preserves it, and additionally logs the benign case at info level
 * (an improvement over the pull loop's own silent handling, not a copy of it).
 * `dispatchBriefApproval` (`handle-reaction-added.ts`) replicates the same unavailable-vs-
 * everything-else split.
 */
export async function approveBriefAndTransitionToPlan(
  deps: ApproveBriefDeps,
  input: {
    readonly ticketId: string;
    readonly projectKey: string;
    readonly claimedBy: string;
  },
): Promise<ApproveBriefResult> {
  const claimed = await deps.claimTicket(input.ticketId, input.claimedBy);
  if (!claimed.ok) {
    return {
      ok: false,
      error: { kind: 'claim-failed', claimError: claimed.error },
    };
  }

  // DA review: the TSDoc above claims this mirrors `workAndRelease` "exactly" — that claim didn't
  // hold until this `.then(ok, err)` guard was added. `workAndRelease` converts a rejecting
  // `workStep` into a resolved `{ok:false}` *before* its always-run release call, via the same
  // `.then` shape (not `try/finally` with a mutable flag — `functional/no-let: 'error'` has no
  // production-code carve-out). Without it, a `transitionTicket` rejection would skip
  // `releaseTicket` entirely and leak an unreleased claim. Every real `transitionTicket` wiring
  // today (`transitionTicketStatus`) is exception-safe by construction, so this guard is currently
  // defensive rather than load-bearing — but the type signature doesn't guarantee that, and this
  // makes the always-releases claim actually true rather than true-by-luck.
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
      'failed to release ticket after reaction-triggered brief approval',
      { ticketId: input.ticketId, claimedBy: input.claimedBy },
    );
  }

  return result;
}
