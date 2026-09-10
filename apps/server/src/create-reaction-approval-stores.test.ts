import type { Database } from '@moe/core';
import type { Kysely } from 'kysely';

import { describe, expect, it, vi } from 'vitest';

import {
  createBriefApprovalPrimitives,
  createBriefStore,
  createPlanApprovalPrimitives,
  createPlanStore,
} from './create-reaction-approval-stores.js';

const mocks = vi.hoisted(() => ({
  claimTicket: vi.fn(),
  getTicketBriefByMessage: vi.fn(),
  getTicketPlanByMessage: vi.fn(),
  releaseTicket: vi.fn(),
  transitionTicketStatus: vi.fn(),
}));

vi.mock('@moe/core', () => ({
  claimTicket: mocks.claimTicket,
  getTicketBriefByMessage: mocks.getTicketBriefByMessage,
  getTicketPlanByMessage: mocks.getTicketPlanByMessage,
  releaseTicket: mocks.releaseTicket,
  transitionTicketStatus: mocks.transitionTicketStatus,
}));

// A never-touched placeholder — every underlying `@moe/core` function is mocked above, so no real
// Kysely query surface is exercised; only that this same handle is threaded through unchanged.
const DB = {} as Kysely<Database>;

describe('createBriefStore', () => {
  it('delegates getByMessage to getTicketBriefByMessage with the shared db handle', async () => {
    mocks.getTicketBriefByMessage.mockResolvedValue({ ok: true, brief: null });
    const store = createBriefStore(DB);

    const result = await store.getByMessage({
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });

    expect(mocks.getTicketBriefByMessage).toHaveBeenCalledWith(DB, {
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });
    expect(result).toEqual({ ok: true, brief: null });
  });
});

describe('createPlanStore', () => {
  it('delegates getByMessage to getTicketPlanByMessage with the shared db handle', async () => {
    mocks.getTicketPlanByMessage.mockResolvedValue({ ok: true, plan: null });
    const store = createPlanStore(DB);

    const result = await store.getByMessage({
      channelId: 'C0B88H0JUA3',
      messageTs: '1700000400.000100',
    });

    expect(mocks.getTicketPlanByMessage).toHaveBeenCalledWith(DB, {
      channelId: 'C0B88H0JUA3',
      messageTs: '1700000400.000100',
    });
    expect(result).toEqual({ ok: true, plan: null });
  });
});

describe('createBriefApprovalPrimitives', () => {
  it('delegates claimTicketForApproval to claimTicket with the shared db handle', async () => {
    mocks.claimTicket.mockResolvedValue({
      ok: true,
      claim: { id: 't1', claimedBy: 'sarah', version: 1 },
    });
    const primitives = createBriefApprovalPrimitives(DB);

    await primitives.claimTicketForApproval('t1', 'sarah');

    expect(mocks.claimTicket).toHaveBeenCalledWith(DB, 't1', 'sarah');
  });

  it('delegates transitionBriefToPlan to transitionTicketStatus with fromStatus Brief / toStatus Plan', async () => {
    mocks.transitionTicketStatus.mockResolvedValue({ ok: true, ticket: {} });
    const primitives = createBriefApprovalPrimitives(DB);

    await primitives.transitionBriefToPlan({
      id: 't1',
      projectKey: 'chief-clancy',
      claimedBy: 'sarah',
    });

    expect(mocks.transitionTicketStatus).toHaveBeenCalledWith(DB, {
      id: 't1',
      projectKey: 'chief-clancy',
      claimedBy: 'sarah',
      fromStatus: 'Brief',
      toStatus: 'Plan',
    });
  });

  it('delegates releaseTicketAfterApproval to releaseTicket with the shared db handle', async () => {
    mocks.releaseTicket.mockResolvedValue({
      ok: true,
      claim: { id: 't1', claimedBy: 'sarah', version: 2 },
    });
    const primitives = createBriefApprovalPrimitives(DB);

    await primitives.releaseTicketAfterApproval('t1', 'sarah');

    expect(mocks.releaseTicket).toHaveBeenCalledWith(DB, 't1', 'sarah');
  });
});

describe('createPlanApprovalPrimitives', () => {
  it('delegates claimTicketForPlanApproval to claimTicket with the shared db handle', async () => {
    mocks.claimTicket.mockResolvedValue({
      ok: true,
      claim: { id: 't1', claimedBy: 'marcus', version: 1 },
    });
    const primitives = createPlanApprovalPrimitives(DB);

    await primitives.claimTicketForPlanApproval('t1', 'marcus');

    expect(mocks.claimTicket).toHaveBeenCalledWith(DB, 't1', 'marcus');
  });

  it('delegates transitionPlanToBuild to transitionTicketStatus with fromStatus Plan / toStatus Build', async () => {
    mocks.transitionTicketStatus.mockResolvedValue({ ok: true, ticket: {} });
    const primitives = createPlanApprovalPrimitives(DB);

    await primitives.transitionPlanToBuild({
      id: 't1',
      projectKey: 'chief-clancy',
      claimedBy: 'marcus',
    });

    expect(mocks.transitionTicketStatus).toHaveBeenCalledWith(DB, {
      id: 't1',
      projectKey: 'chief-clancy',
      claimedBy: 'marcus',
      fromStatus: 'Plan',
      toStatus: 'Build',
    });
  });

  it('delegates releaseTicketAfterPlanApproval to releaseTicket with the shared db handle', async () => {
    mocks.releaseTicket.mockResolvedValue({
      ok: true,
      claim: { id: 't1', claimedBy: 'marcus', version: 2 },
    });
    const primitives = createPlanApprovalPrimitives(DB);

    await primitives.releaseTicketAfterPlanApproval('t1', 'marcus');

    expect(mocks.releaseTicket).toHaveBeenCalledWith(DB, 't1', 'marcus');
  });
});
