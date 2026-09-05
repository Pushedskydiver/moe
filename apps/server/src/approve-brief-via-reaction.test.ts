import type { ApproveBriefDeps } from './approve-brief-via-reaction.js';
import type { ClaimResult, Ticket, TransitionResult } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { approveBriefAndTransitionToPlan } from './approve-brief-via-reaction.js';

const TICKET_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const CLAIMED_BY = 'marcus';
const PROJECT_KEY = 'chief-clancy';

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: TICKET_ID,
    projectKey: PROJECT_KEY,
    title: 'The login page returns a 500 on submit',
    status: 'Plan',
    severity: 'Medium',
    classOfService: 'Standard',
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    updatedAt: new Date('2026-09-05T09:00:00.000Z'),
    ...overrides,
  };
}

function makeSuccessfulClaim(): ClaimResult {
  return {
    ok: true,
    claim: { id: TICKET_ID, claimedBy: CLAIMED_BY, version: 2 },
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeDeps(overrides: Partial<ApproveBriefDeps> = {}): ApproveBriefDeps {
  return {
    claimTicket: vi
      .fn<ApproveBriefDeps['claimTicket']>()
      .mockResolvedValue(makeSuccessfulClaim()),
    transitionTicket: vi
      .fn<ApproveBriefDeps['transitionTicket']>()
      .mockResolvedValue({ ok: true, ticket: makeTicket() }),
    releaseTicket: vi
      .fn<ApproveBriefDeps['releaseTicket']>()
      .mockResolvedValue(makeSuccessfulClaim()),
    logger: makeLogger(),
    ...overrides,
  };
}

describe('approveBriefAndTransitionToPlan', () => {
  it('returns claim-failed with the original ClaimError preserved, and attempts neither a transition nor a release, when the claim fails', async () => {
    const deps = makeDeps({
      claimTicket: vi
        .fn<ApproveBriefDeps['claimTicket']>()
        .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
    });

    const result = await approveBriefAndTransitionToPlan(deps, {
      ticketId: TICKET_ID,
      projectKey: PROJECT_KEY,
      claimedBy: CLAIMED_BY,
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'claim-failed', claimError: { kind: 'unavailable' } },
    });
    expect(deps.transitionTicket).not.toHaveBeenCalled();
    expect(deps.releaseTicket).not.toHaveBeenCalled();
  });

  it('claims, transitions, releases, and returns the successful transition result', async () => {
    const deps = makeDeps();

    const result = await approveBriefAndTransitionToPlan(deps, {
      ticketId: TICKET_ID,
      projectKey: PROJECT_KEY,
      claimedBy: CLAIMED_BY,
    });

    expect(deps.claimTicket).toHaveBeenCalledWith(TICKET_ID, CLAIMED_BY);
    expect(deps.transitionTicket).toHaveBeenCalledWith({
      id: TICKET_ID,
      projectKey: PROJECT_KEY,
      claimedBy: CLAIMED_BY,
    });
    expect(deps.releaseTicket).toHaveBeenCalledWith(TICKET_ID, CLAIMED_BY);
    expect(result).toEqual({ ok: true, ticket: makeTicket() });
  });

  it('still releases the claim, and still returns the wip-limit-blocked result unchanged, when the transition is blocked by the WIP limit', async () => {
    const blockedResult: TransitionResult = {
      ok: false,
      error: { kind: 'wip-limit-blocked', reason: 'at-limit' },
    };
    const deps = makeDeps({
      transitionTicket: vi
        .fn<ApproveBriefDeps['transitionTicket']>()
        .mockResolvedValue(blockedResult),
    });

    const result = await approveBriefAndTransitionToPlan(deps, {
      ticketId: TICKET_ID,
      projectKey: PROJECT_KEY,
      claimedBy: CLAIMED_BY,
    });

    expect(deps.releaseTicket).toHaveBeenCalledWith(TICKET_ID, CLAIMED_BY);
    expect(result).toEqual(blockedResult);
  });

  it('still releases the claim, and maps the rejection to an unknown-kind TransitionResult, when transitionTicket rejects instead of resolving', async () => {
    const cause = new Error('connection reset');
    const deps = makeDeps({
      transitionTicket: vi
        .fn<ApproveBriefDeps['transitionTicket']>()
        .mockRejectedValue(cause),
    });

    const result = await approveBriefAndTransitionToPlan(deps, {
      ticketId: TICKET_ID,
      projectKey: PROJECT_KEY,
      claimedBy: CLAIMED_BY,
    });

    expect(deps.releaseTicket).toHaveBeenCalledWith(TICKET_ID, CLAIMED_BY);
    expect(result).toEqual({ ok: false, error: { kind: 'unknown', cause } });
  });

  it('logs an error but still returns the successful transition result unchanged, when the release fails after a successful transition', async () => {
    const deps = makeDeps({
      releaseTicket: vi
        .fn<ApproveBriefDeps['releaseTicket']>()
        .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
    });

    const result = await approveBriefAndTransitionToPlan(deps, {
      ticketId: TICKET_ID,
      projectKey: PROJECT_KEY,
      claimedBy: CLAIMED_BY,
    });

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to release ticket after reaction-triggered brief approval',
      { ticketId: TICKET_ID, claimedBy: CLAIMED_BY },
    );
    expect(result).toEqual({ ok: true, ticket: makeTicket() });
  });
});
