import type { Logger } from './logger.js';
import type { PullLoopDeps } from './pull-loop.js';
import type {
  ClaimResult,
  createBankHolidaysCache,
  Ticket,
  TicketListResult,
} from '@moe/core';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runPullLoopTick, schedulePullLoopTicks } from './pull-loop.js';

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

  it('returns outside-core-hours without calling listClaimable', async () => {
    const deps = makeDeps();

    const result = await runPullLoopTick(deps, OUTSIDE_CORE_HOURS);

    expect(result).toEqual({ outcome: 'outside-core-hours' });
    expect(deps.ticketStore.listClaimable).not.toHaveBeenCalled();
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
