import type { Ticket } from '../ticket.js';

import { describe, expect, it } from 'vitest';

import { findNextClaimableTicket } from './find-next-claimable-ticket.js';

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

describe('findNextClaimableTicket', () => {
  it('returns null on an empty list', () => {
    expect(findNextClaimableTicket([])).toBeNull();
  });

  it('returns the only ticket when there is exactly one', () => {
    const only = makeTicket({ id: '00000000-0000-0000-0000-000000000001' });
    expect(findNextClaimableTicket([only])).toBe(only);
  });

  it('prefers Expedite over an older Standard ticket', () => {
    const olderStandard = makeTicket({
      id: '00000000-0000-0000-0000-000000000001',
      classOfService: 'Standard',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newerExpedite = makeTicket({
      id: '00000000-0000-0000-0000-000000000002',
      classOfService: 'Expedite',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(findNextClaimableTicket([olderStandard, newerExpedite])).toBe(
      newerExpedite,
    );
  });

  it('picks the oldest createdAt within the same class of service', () => {
    const older = makeTicket({
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newer = makeTicket({
      id: '00000000-0000-0000-0000-000000000002',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(findNextClaimableTicket([newer, older])).toBe(older);
  });

  it('breaks a createdAt tie deterministically by id', () => {
    const tiedCreatedAt = new Date('2026-01-01T00:00:00.000Z');
    const higherId = makeTicket({
      id: '00000000-0000-0000-0000-000000000002',
      createdAt: tiedCreatedAt,
    });
    const lowerId = makeTicket({
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: tiedCreatedAt,
    });
    expect(findNextClaimableTicket([higherId, lowerId])).toBe(lowerId);
  });
});
