import type { Logger } from './logger.js';
import type {
  BoardStatus,
  ClaimResult,
  createBankHolidaysCache,
  Database,
  PersonaId,
  Ticket,
  TicketListResult,
} from '@moe/core';
import type { Kysely } from 'kysely';

import {
  claimTicket,
  evaluateOperatingRhythm,
  findNextClaimableTicket,
  listClaimableTickets,
  PERSONA_CLAIMABLE_STAGES,
  PROJECT_KEY,
  releaseTicket,
} from '@moe/core';

import { repositoryErrorMessage } from './repository-error.js';

// Same `ReturnType<typeof X>` idiom `handle-inbound-message.ts`'s own `BankHolidaysCache` alias
// uses — `Cached` itself is deliberately not re-exported from `@moe/core` (`cached.ts`'s own
// TSDoc), so this derives the type from the one exported factory instead.
type BankHolidaysCache = ReturnType<typeof createBankHolidaysCache>;

export type PullLoopWorkStep = (ticket: Ticket) => Promise<void>;

// A pull-loop-only DI seam, not `HandlerDeps`'s own `ticketStore` — mirrors
// `review-queue-sweep.ts`'s own `SweepDeps` precedent: this loop needs `listClaimable`/`claim`/
// `release`, methods the live message/reaction-handling path never calls, so widening
// `HandlerDeps` would leak a pull-loop-only concern into the live server's own DI surface.
export type PullLoopDeps = {
  readonly personaId: PersonaId;
  readonly logger: Logger;
  readonly bankHolidaysCache: BankHolidaysCache;
  readonly ticketStore: {
    readonly listClaimable: (
      statuses: readonly BoardStatus[],
    ) => Promise<TicketListResult>;
    readonly claim: (id: string, claimedBy: string) => Promise<ClaimResult>;
    readonly release: (id: string, claimedBy: string) => Promise<ClaimResult>;
  };
  readonly workStep: PullLoopWorkStep;
  // BUILD_PLAN 6.1b's generic pre-tick hook — called once per in-hours tick, before
  // `listClaimable`, for a persona-specific proactive action that isn't itself claiming/working a
  // ticket (Sarah's own triage-queue-to-ticket conversion, `convert-next-triage-entry.ts`). A
  // required field, no-op for personas with nothing to do — same precedent `workStep` itself
  // already set. Generic here rather than a Sarah-specific wrapper around `runPullLoopTick`, so
  // `PullLoopImpl`'s own `setInterval`/overlap-skip machinery (below) never needs persona-specific
  // branching. Must never throw — same "fire it, it handles its own errors" contract
  // `sendCostAlerts` already uses in `check-cost-cap.ts` — since nothing here catches a rejection
  // from it.
  readonly preTickStep: (now: Date) => Promise<void>;
};

export type PullLoopTickOutcome =
  | 'no-eligible-stages'
  | 'outside-core-hours'
  | 'list-failed'
  | 'no-claimable-ticket'
  | 'claim-lost-race'
  | 'claim-failed'
  | 'work-step-failed'
  | 'worked';

export type PullLoopTickResult = {
  readonly outcome: PullLoopTickOutcome;
  readonly ticketId?: string;
};

// Runs `workStep`, then always releases the claim regardless of whether it threw — a `.then`
// conversion to an always-resolved outcome, not `try/finally` with a mutable flag, since
// `functional/no-let: 'error'` has no production-code carve-out (`eslint.config.ts`). A failed
// `release` is logged as an orphaned-claim residual risk (accepted — BUILD_PLAN 6.1a-ii scoped
// itself to the transition function + WIP gate only; clearing a claim stuck by a failed release
// call is deferred to BUILD_PLAN 6.6's stale-claim recovery handler, not built yet) but does not
// change the returned outcome, which reflects `workStep` alone.
async function workAndRelease(
  deps: PullLoopDeps,
  ticket: Ticket,
): Promise<PullLoopTickResult> {
  const workOutcome = await deps.workStep(ticket).then(
    (): { readonly ok: true } => ({ ok: true }),
    (cause: unknown): { readonly ok: false; readonly cause: unknown } => ({
      ok: false,
      cause,
    }),
  );

  const released = await deps.ticketStore.release(ticket.id, deps.personaId);
  if (!released.ok) {
    deps.logger.error('pull loop failed to release ticket after work step', {
      personaId: deps.personaId,
      ticketId: ticket.id,
    });
  }

  if (!workOutcome.ok) {
    deps.logger.error('pull loop work step failed', {
      personaId: deps.personaId,
      ticketId: ticket.id,
      errorMessage:
        workOutcome.cause instanceof Error
          ? workOutcome.cause.message
          : String(workOutcome.cause),
    });
    return { outcome: 'work-step-failed', ticketId: ticket.id };
  }

  deps.logger.info('pull loop claimed and worked a ticket', {
    personaId: deps.personaId,
    ticketId: ticket.id,
  });
  return { outcome: 'worked', ticketId: ticket.id };
}

/**
 * BUILD_PLAN 6.1a-i's pull-loop wake cycle — one poll/claim/work/release attempt, directly
 * unit-testable (no fake timers needed; `startPullLoop` below is the timer wrapper).
 *
 * Cheapest-first ordering, mirroring `evaluateSenderFrequencyGuard`'s own documented reasoning
 * for running first (a synchronous in-memory check, ahead of any I/O, so a request the guard
 * would suppress anyway never pays for it): `PERSONA_CLAIMABLE_STAGES` is a free, synchronous
 * lookup, so a stage-less persona (priya/theo/nia/maya, today) short-circuits before ever
 * touching the bank-holidays cache or the database — not just before the DB, the cache too.
 */
export async function runPullLoopTick(
  deps: PullLoopDeps,
  now: Date,
): Promise<PullLoopTickResult> {
  const claimableStages = PERSONA_CLAIMABLE_STAGES[deps.personaId];
  if (claimableStages.length === 0) {
    return { outcome: 'no-eligible-stages' };
  }

  const rhythm = await evaluateOperatingRhythm(now, deps.bankHolidaysCache);
  if (!rhythm.withinCoreHours) {
    return { outcome: 'outside-core-hours' };
  }

  await deps.preTickStep(now);

  const listed = await deps.ticketStore.listClaimable(claimableStages);
  if (!listed.ok) {
    deps.logger.error('pull loop failed to list claimable tickets', {
      personaId: deps.personaId,
      errorMessage: repositoryErrorMessage(listed.error),
    });
    return { outcome: 'list-failed' };
  }

  const next = findNextClaimableTicket(listed.tickets);
  if (!next) {
    return { outcome: 'no-claimable-ticket' };
  }

  const claimed = await deps.ticketStore.claim(next.id, deps.personaId);
  if (!claimed.ok) {
    if (claimed.error.kind === 'unavailable') {
      return { outcome: 'claim-lost-race' };
    }
    deps.logger.error('pull loop failed to claim ticket', {
      personaId: deps.personaId,
      ticketId: next.id,
      errorMessage: repositoryErrorMessage(claimed.error),
    });
    return { outcome: 'claim-failed' };
  }

  return workAndRelease(deps, next);
}

export type StartPullLoopDeps = {
  readonly personaId: PersonaId;
  readonly db: Kysely<Database>;
  readonly logger: Logger;
  readonly bankHolidaysCache: BankHolidaysCache;
  readonly workStep: PullLoopWorkStep;
  readonly preTickStep: (now: Date) => Promise<void>;
};

function buildPullLoopDeps(deps: StartPullLoopDeps): PullLoopDeps {
  return {
    personaId: deps.personaId,
    logger: deps.logger,
    bankHolidaysCache: deps.bankHolidaysCache,
    ticketStore: {
      listClaimable: (statuses) =>
        listClaimableTickets(deps.db, {
          projectKey: PROJECT_KEY,
          statuses,
        }),
      claim: (id, claimedBy) => claimTicket(deps.db, id, claimedBy),
      release: (id, claimedBy) => releaseTicket(deps.db, id, claimedBy),
    },
    workStep: deps.workStep,
    preTickStep: deps.preTickStep,
  };
}

// A class, not a closure over a module-level `let`, per `docs/CONVENTIONS.md`'s "Cache via a
// `Cached<T>` class" rule and `thread-queue.ts`'s own precedent for this exact problem —
// `functional/no-let: 'error'` has no production-code carve-out. Takes `PullLoopDeps` directly
// (not `StartPullLoopDeps`) so the scheduling behavior — tick cadence, overlap-skip, stop — is
// unit-testable against a plain fake `ticketStore`, the same DI boundary `runPullLoopTick` itself
// already uses, without needing a real (or elaborately faked) `Kysely` query builder.
class PullLoopImpl {
  readonly #handle: NodeJS.Timeout;
  // Genuinely mutable (flipped true/false around every tick to guard against overlap), so
  // `readonly` here would be actively wrong, not just unenforced — same shape `cached.ts`'s own
  // `#state` field documents for the identical reason.
  // eslint-disable-next-line functional/prefer-readonly-type
  #ticking = false;

  constructor(deps: PullLoopDeps, intervalMs: number) {
    this.#handle = setInterval(() => {
      if (this.#ticking) {
        deps.logger.info('pull loop skipped an overlapping tick', {
          personaId: deps.personaId,
        });
        return;
      }
      this.#ticking = true;
      runPullLoopTick(deps, new Date())
        .catch((cause: unknown) => {
          // Should be unreachable — runPullLoopTick resolves on every path it knows about. A
          // defensive backstop only, so an unforeseen throw can't silently kill the interval.
          deps.logger.error('pull loop tick threw unexpectedly', {
            personaId: deps.personaId,
            errorMessage:
              cause instanceof Error ? cause.message : String(cause),
          });
        })
        .finally(() => {
          this.#ticking = false;
        });
    }, intervalMs);
  }

  readonly stop = (): void => {
    clearInterval(this.#handle);
  };
}

/**
 * The scheduling primitive itself — `PullLoopImpl` at the `PullLoopDeps` DI boundary, exported
 * separately from `startPullLoop` below so tick cadence/overlap-skip/stop are unit-testable
 * against a plain fake `ticketStore`, without needing a real or faked `Kysely` query builder.
 */
export function schedulePullLoopTicks(
  deps: PullLoopDeps,
  intervalMs: number,
): { readonly stop: () => void } {
  return new PullLoopImpl(deps, intervalMs);
}

/**
 * BUILD_PLAN 6.1a-i's per-persona poll scheduler — `main.ts`'s own entry point. Wraps
 * `runPullLoopTick` in a `setInterval` (via `schedulePullLoopTicks`), skipping an overlapping
 * tick rather than queuing one if a wake takes longer than `intervalMs`. The first tick fires
 * after one full interval, not immediately on construction (Alex confirmed: simpler and
 * lower-risk than making this injectable into `main()`, which is already at its 3-param ESLint
 * ceiling).
 */
export function startPullLoop(
  deps: StartPullLoopDeps,
  intervalMs: number,
): { readonly stop: () => void } {
  return schedulePullLoopTicks(buildPullLoopDeps(deps), intervalMs);
}
