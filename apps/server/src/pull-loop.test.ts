import type { Logger } from './logger.js';
import type { PullLoopDeps, StartPullLoopDeps } from './pull-loop.js';
import type * as CoreModule from '@moe/core';
import type {
  ClaimResult,
  createBankHolidaysCache,
  Database,
  Ticket,
  TicketListResult,
} from '@moe/core';
import type { Kysely } from 'kysely';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROJECT_KEY } from '@moe/core';

import {
  runPullLoopTick,
  schedulePullLoopTicks,
  startPullLoop,
} from './pull-loop.js';

// `startPullLoop`'s own DI-wiring composition root (`buildPullLoopDeps`, not directly exported)
// closes over the real `@moe/core` repository functions — mocking them here is the only way to
// unit-test that wiring without a real `Kysely` query builder (DA review, BUILD_PLAN 6.1a-i:
// `startPullLoop` had zero direct test coverage, since `main.test.ts` mocks this whole module
// away and the tests above only ever exercise the `PullLoopDeps`-level primitives).
const coreMocks = vi.hoisted(() => ({
  listClaimableTickets: vi.fn(),
  claimTicket: vi.fn(),
  releaseTicket: vi.fn(),
}));

vi.mock('@moe/core', async (importOriginal) => {
  const actual = await importOriginal<typeof CoreModule>();
  return {
    ...actual,
    listClaimableTickets: coreMocks.listClaimableTickets,
    claimTicket: coreMocks.claimTicket,
    releaseTicket: coreMocks.releaseTicket,
  };
});

// Same `ReturnType<typeof X>` idiom `pull-loop.ts` itself (and `handle-inbound-message.ts`'s own
// `BankHolidaysCache` alias) uses — `Cached` is deliberately not re-exported from `@moe/core`.
type BankHolidaysCache = ReturnType<typeof createBankHolidaysCache>;

function fakeBankHolidaysCache(
  get: BankHolidaysCache['get'],
): BankHolidaysCache {
  return { get } as BankHolidaysCache;
}

function withinCoreHoursCache(): BankHolidaysCache {
  return fakeBankHolidaysCache(
    vi.fn().mockResolvedValue({ ok: true, value: [], stale: false }),
  );
}

// 2026-01-12 is a Monday, 10:00 UTC — within DEFAULT_CORE_HOURS_CONFIG's 08:30-17:00 window.
const WITHIN_CORE_HOURS = new Date('2026-01-12T10:00:00Z');
// 2026-01-10 is a Saturday — outside the window entirely, short-circuits before the cache.
const OUTSIDE_CORE_HOURS = new Date('2026-01-10T10:00:00Z');

function makeTicket(overrides: Partial<Ticket> & Pick<Ticket, 'id'>): Ticket {
  return {
    projectKey: 'chief-clancy',
    title: 'A ticket',
    status: 'Brief',
    severity: 'Medium',
    classOfService: 'Standard',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeDeps(overrides: Partial<PullLoopDeps> = {}): PullLoopDeps {
  return {
    personaId: 'sarah',
    logger: makeLogger(),
    bankHolidaysCache: withinCoreHoursCache(),
    ticketStore: {
      listClaimable: vi.fn().mockResolvedValue({ ok: true, tickets: [] }),
      claim: vi.fn(),
      release: vi.fn().mockResolvedValue({
        ok: true,
        claim: { id: 'x', claimedBy: null, version: 2 },
      }),
    },
    workStep: vi.fn().mockResolvedValue(undefined),
    preTickStep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runPullLoopTick', () => {
  it('returns no-eligible-stages for a stage-less persona without touching the cache or listClaimable', async () => {
    const get = vi.fn();
    const deps = makeDeps({
      personaId: 'theo',
      bankHolidaysCache: fakeBankHolidaysCache(get),
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'no-eligible-stages' });
    expect(get).not.toHaveBeenCalled();
    expect(deps.ticketStore.listClaimable).not.toHaveBeenCalled();
  });

  it('does not call preTickStep for a stage-less persona (BUILD_PLAN 6.1b)', async () => {
    const deps = makeDeps({ personaId: 'theo' });

    await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(deps.preTickStep).not.toHaveBeenCalled();
  });

  it('returns outside-core-hours without calling listClaimable', async () => {
    const deps = makeDeps();

    const result = await runPullLoopTick(deps, OUTSIDE_CORE_HOURS);

    expect(result).toEqual({ outcome: 'outside-core-hours' });
    expect(deps.ticketStore.listClaimable).not.toHaveBeenCalled();
  });

  it('does not call preTickStep outside core hours (BUILD_PLAN 6.1b)', async () => {
    const deps = makeDeps();

    await runPullLoopTick(deps, OUTSIDE_CORE_HOURS);

    expect(deps.preTickStep).not.toHaveBeenCalled();
  });

  it('calls preTickStep exactly once per in-hours tick, with now, before listClaimable (BUILD_PLAN 6.1b)', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      preTickStep: vi.fn().mockImplementation(async () => {
        order.push('preTickStep');
      }),
      ticketStore: {
        listClaimable: vi.fn().mockImplementation(async () => {
          order.push('listClaimable');
          return { ok: true, tickets: [] };
        }),
        claim: vi.fn(),
        release: vi.fn(),
      },
    });

    await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(deps.preTickStep).toHaveBeenCalledTimes(1);
    expect(deps.preTickStep).toHaveBeenCalledWith(WITHIN_CORE_HOURS);
    expect(order).toEqual(['preTickStep', 'listClaimable']);
  });

  it('returns no-claimable-ticket when listClaimable resolves empty', async () => {
    const deps = makeDeps();

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'no-claimable-ticket' });
    expect(deps.ticketStore.listClaimable).toHaveBeenCalledWith(['Brief']);
  });

  it('claims, runs the work step, then releases, in that order, for a claimable ticket', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const order: string[] = [];
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim: vi.fn().mockImplementation(async () => {
          order.push('claim');
          return {
            ok: true,
            claim: { id: ticket.id, claimedBy: 'sarah', version: 1 },
          } satisfies ClaimResult;
        }),
        release: vi.fn().mockImplementation(async () => {
          order.push('release');
          return {
            ok: true,
            claim: { id: ticket.id, claimedBy: null, version: 2 },
          } satisfies ClaimResult;
        }),
      },
      workStep: vi.fn().mockImplementation(async () => {
        order.push('work');
      }),
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'worked', ticketId: ticket.id });
    expect(order).toEqual(['claim', 'work', 'release']);
    expect(deps.workStep).toHaveBeenCalledWith(ticket);
    expect(deps.ticketStore.claim).toHaveBeenCalledWith(ticket.id, 'sarah');
    expect(deps.ticketStore.release).toHaveBeenCalledWith(ticket.id, 'sarah');
  });

  it('still releases, and reports work-step-failed, when the work step throws', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: ticket.id, claimedBy: 'sarah', version: 1 },
        } satisfies ClaimResult),
        release: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: ticket.id, claimedBy: null, version: 2 },
        } satisfies ClaimResult),
      },
      workStep: vi.fn().mockRejectedValue(new Error('boom')),
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({
      outcome: 'work-step-failed',
      ticketId: ticket.id,
    });
    expect(deps.ticketStore.release).toHaveBeenCalledWith(ticket.id, 'sarah');
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('work step'),
      expect.objectContaining({ ticketId: ticket.id }),
    );
  });

  it('returns claim-lost-race without calling the work step when the claim is unavailable', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const workStep = vi.fn();
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim: vi
          .fn()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
        release: vi.fn(),
      },
      workStep,
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'claim-lost-race' });
    expect(workStep).not.toHaveBeenCalled();
  });

  it('logs an error and returns list-failed when listClaimable fails', async () => {
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi.fn().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('db down') },
        } satisfies TicketListResult),
        claim: vi.fn(),
        release: vi.fn(),
      },
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'list-failed' });
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('logs an error and returns claim-failed on a non-unavailable claim error', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim: vi.fn().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('db down') },
        }),
        release: vi.fn(),
      },
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'claim-failed' });
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('still reports worked, but logs an error, when release fails after a successful work step', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: ticket.id, claimedBy: 'sarah', version: 1 },
        }),
        release: vi
          .fn()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
      },
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'worked', ticketId: ticket.id });
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('release'),
      expect.objectContaining({ ticketId: ticket.id }),
    );
  });
});

describe('runPullLoopTick with needsWork (BUILD_PLAN 6.1b starvation fix)', () => {
  it('does not call needsWork at all when it is undefined (default preserves existing behavior)', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: ticket.id, claimedBy: 'sarah', version: 1 },
        }),
        release: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: ticket.id, claimedBy: null, version: 2 },
        }),
      },
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'worked', ticketId: ticket.id });
  });

  it('filters out a ticket whose needsWork resolves false, keeping a ready one', async () => {
    const staleTicket = makeTicket({
      id: '00000000-0000-0000-0000-000000000001',
    });
    const readyTicket = makeTicket({
      id: '00000000-0000-0000-0000-000000000002',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [staleTicket, readyTicket] }),
        claim: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: readyTicket.id, claimedBy: 'sarah', version: 1 },
        }),
        release: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: readyTicket.id, claimedBy: null, version: 2 },
        }),
      },
      needsWork: vi
        .fn()
        .mockImplementation(async (t: Ticket) => t.id !== staleTicket.id),
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'worked', ticketId: readyTicket.id });
    expect(deps.ticketStore.claim).toHaveBeenCalledWith(
      readyTicket.id,
      'sarah',
    );
  });

  it('picks correctly among a mix when needsWork excludes only some candidates', async () => {
    const expedite = makeTicket({
      id: '00000000-0000-0000-0000-000000000001',
      classOfService: 'Expedite',
    });
    const standardOlder = makeTicket({
      id: '00000000-0000-0000-0000-000000000002',
      classOfService: 'Standard',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const standardNewer = makeTicket({
      id: '00000000-0000-0000-0000-000000000003',
      classOfService: 'Standard',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi.fn().mockResolvedValue({
          ok: true,
          tickets: [expedite, standardOlder, standardNewer],
        }),
        claim: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: standardNewer.id, claimedBy: 'sarah', version: 1 },
        }),
        release: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: standardNewer.id, claimedBy: null, version: 2 },
        }),
      },
      // Excludes both the Expedite ticket and the older Standard one — only the newer Standard
      // ticket "needs work," confirming the filter runs before findNextClaimableTicket's own
      // class-of-service/createdAt ordering, not instead of it.
      needsWork: vi
        .fn()
        .mockImplementation(async (t: Ticket) => t.id === standardNewer.id),
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'worked', ticketId: standardNewer.id });
  });

  it('falls through to no-claimable-ticket when needsWork filters out every candidate', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const claim = vi.fn();
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim,
        release: vi.fn(),
      },
      needsWork: vi.fn().mockResolvedValue(false),
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'no-claimable-ticket' });
    expect(claim).not.toHaveBeenCalled();
  });

  it('fails open (includes the ticket) when needsWork rejects, logging a warning', async () => {
    const ticket = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [ticket] }),
        claim: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: ticket.id, claimedBy: 'sarah', version: 1 },
        }),
        release: vi.fn().mockResolvedValue({
          ok: true,
          claim: { id: ticket.id, claimedBy: null, version: 2 },
        }),
      },
      needsWork: vi.fn().mockRejectedValue(new Error('boom')),
    });

    const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);

    expect(result).toEqual({ outcome: 'worked', ticketId: ticket.id });
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('needsWork'),
      expect.objectContaining({ ticketId: ticket.id }),
    );
  });

  it('regression: with two tickets in Brief where one no longer needs work, the OTHER (newer) one gets picked across multiple ticks — not starved forever by the older one', async () => {
    const alreadyBriefed = makeTicket({
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newerNeedsWork = makeTicket({
      id: '00000000-0000-0000-0000-000000000002',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
    });
    // Simulates ticket_briefs state: alreadyBriefed starts already-briefed; the work step
    // "briefs" whatever it's given, same as handleBriefStageTicket persisting a pointer.
    const briefedIds = new Set<string>([alreadyBriefed.id]);
    const claim = vi
      .fn()
      .mockImplementation(async (id: string, claimedBy: string) => ({
        ok: true,
        claim: { id, claimedBy, version: 1 },
      }));
    const release = vi
      .fn()
      .mockImplementation(async (id: string, _claimedBy: string) => ({
        ok: true,
        claim: { id, claimedBy: null, version: 2 },
      }));
    const deps = makeDeps({
      ticketStore: {
        listClaimable: vi.fn().mockResolvedValue({
          ok: true,
          tickets: [alreadyBriefed, newerNeedsWork],
        }),
        claim,
        release,
      },
      needsWork: vi
        .fn()
        .mockImplementation(async (t: Ticket) => !briefedIds.has(t.id)),
      workStep: vi.fn().mockImplementation(async (t: Ticket) => {
        briefedIds.add(t.id);
      }),
    });

    // Five sequential ticks — recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code
    // Style section bans the latter outright; `discover-github-issues.ts`'s own `upsertIssues` is
    // the established precedent for sequential-by-design async work over a short, fixed list). The
    // ticks must run in order, not in parallel: each depends on `briefedIds` mutated by the
    // previous tick's `workStep`.
    async function runTicks(
      remaining: number,
      claimed: readonly string[],
    ): Promise<readonly string[]> {
      if (remaining === 0) return claimed;
      const result = await runPullLoopTick(deps, WITHIN_CORE_HOURS);
      const next =
        result.ticketId === undefined ? claimed : [...claimed, result.ticketId];
      return runTicks(remaining - 1, next);
    }
    const claimedIds = await runTicks(5, []);

    // The newer ticket must actually get claimed — the pre-fix bug meant it never would.
    expect(claimedIds).toContain(newerNeedsWork.id);
    // The already-briefed ticket must never be claimed again — it's filtered before claiming.
    expect(claimedIds).not.toContain(alreadyBriefed.id);
  });
});

describe('schedulePullLoopTicks', () => {
  beforeEach(() => {
    // Fixes `new Date()` inside each tick to a known within-core-hours instant — `runPullLoopTick`
    // calls `evaluateOperatingRhythm` with the real wall-clock time otherwise, so a test run
    // outside Mon-Fri 08:30-17:00 Europe/London would silently short-circuit before ever reaching
    // `listClaimable`.
    vi.useFakeTimers();
    vi.setSystemTime(WITHIN_CORE_HOURS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks once per elapsed interval', async () => {
    const workStep = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ workStep });
    const loop = schedulePullLoopTicks(deps, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(deps.ticketStore.listClaimable).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(deps.ticketStore.listClaimable).toHaveBeenCalledTimes(2);

    loop.stop();
  });

  it('skips an overlapping tick when the previous one has not resolved yet', async () => {
    let resolveFirstTick: (() => void) | undefined;
    const listClaimable = vi.fn().mockImplementation(
      () =>
        new Promise<TicketListResult>((resolve) => {
          resolveFirstTick = () => resolve({ ok: true, tickets: [] });
        }),
    );
    const deps = makeDeps({
      ticketStore: { listClaimable, claim: vi.fn(), release: vi.fn() },
    });
    const loop = schedulePullLoopTicks(deps, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(listClaimable).toHaveBeenCalledTimes(1);

    // The first tick is still in flight (its listClaimable promise hasn't resolved) when the
    // second interval elapses — that second tick must be skipped, not queued.
    await vi.advanceTimersByTimeAsync(1000);
    expect(listClaimable).toHaveBeenCalledTimes(1);

    resolveFirstTick?.();
    await vi.advanceTimersByTimeAsync(0);
    loop.stop();
  });

  it('stops ticking once stop() is called', async () => {
    const deps = makeDeps();
    const loop = schedulePullLoopTicks(deps, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect(deps.ticketStore.listClaimable).toHaveBeenCalledTimes(1);

    loop.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(deps.ticketStore.listClaimable).toHaveBeenCalledTimes(1);
  });
});

describe('startPullLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(WITHIN_CORE_HOURS);
    coreMocks.listClaimableTickets
      .mockReset()
      .mockResolvedValue({ ok: true, tickets: [] });
    coreMocks.claimTicket.mockReset();
    coreMocks.releaseTicket.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeStartDeps(
    overrides: Partial<StartPullLoopDeps> = {},
  ): StartPullLoopDeps {
    return {
      personaId: 'sarah',
      db: {} as Kysely<Database>, // opaque — listClaimableTickets/claimTicket/releaseTicket are mocked
      logger: makeLogger(),
      bankHolidaysCache: withinCoreHoursCache(),
      workStep: vi.fn().mockResolvedValue(undefined),
      preTickStep: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('wires listClaimable to the real listClaimableTickets, with the right db/projectKey/statuses', async () => {
    const deps = makeStartDeps();
    const loop = startPullLoop(deps, 1000);

    await vi.advanceTimersByTimeAsync(1000);

    expect(coreMocks.listClaimableTickets).toHaveBeenCalledWith(deps.db, {
      projectKey: PROJECT_KEY,
      statuses: ['Brief'],
    });
    loop.stop();
  });

  it('wires claim/release to the real claimTicket/releaseTicket, with the right db/id/personaId', async () => {
    const ticket = {
      id: '00000000-0000-0000-0000-000000000001',
      projectKey: 'chief-clancy',
      title: 'A ticket',
      status: 'Brief',
      severity: 'Medium',
      classOfService: 'Standard',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies Ticket;
    coreMocks.listClaimableTickets.mockResolvedValue({
      ok: true,
      tickets: [ticket],
    } satisfies TicketListResult);
    coreMocks.claimTicket.mockResolvedValue({
      ok: true,
      claim: { id: ticket.id, claimedBy: 'sarah', version: 1 },
    } satisfies ClaimResult);
    coreMocks.releaseTicket.mockResolvedValue({
      ok: true,
      claim: { id: ticket.id, claimedBy: null, version: 2 },
    } satisfies ClaimResult);
    const deps = makeStartDeps();
    const loop = startPullLoop(deps, 1000);

    await vi.advanceTimersByTimeAsync(1000);

    expect(coreMocks.claimTicket).toHaveBeenCalledWith(
      deps.db,
      ticket.id,
      'sarah',
    );
    expect(coreMocks.releaseTicket).toHaveBeenCalledWith(
      deps.db,
      ticket.id,
      'sarah',
    );
    loop.stop();
  });

  it("wires needsWork through StartPullLoopDeps/buildPullLoopDeps to the real PullLoopDeps runPullLoopTick ticks against (BUILD_PLAN 6.1b starvation fix, spec-grill R1's B1)", async () => {
    const ticket = {
      id: '00000000-0000-0000-0000-000000000001',
      projectKey: 'chief-clancy',
      title: 'A ticket',
      status: 'Brief',
      severity: 'Medium',
      classOfService: 'Standard',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies Ticket;
    coreMocks.listClaimableTickets.mockResolvedValue({
      ok: true,
      tickets: [ticket],
    } satisfies TicketListResult);
    const needsWork = vi.fn().mockResolvedValue(false);
    const deps = makeStartDeps({ needsWork });
    const loop = startPullLoop(deps, 1000);

    await vi.advanceTimersByTimeAsync(1000);

    expect(needsWork).toHaveBeenCalledWith(ticket);
    // needsWork resolved false, so the filtered candidate must never reach claimTicket — proves
    // needsWork actually reaches the real PullLoopDeps runPullLoopTick uses, not just a directly
    // constructed PullLoopDeps in the tests above.
    expect(coreMocks.claimTicket).not.toHaveBeenCalled();
    loop.stop();
  });
});
