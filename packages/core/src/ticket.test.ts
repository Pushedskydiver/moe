import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isNotBlank } from './is-not-blank.js';
import { ticketSchema } from './ticket.js';

function validTicket(): Record<string, unknown> {
  return {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    projectKey: 'chief-clancy',
    title: 'Fix the Slack rate-limit tier lookup',
    status: 'Backlog',
    severity: 'Medium',
    createdAt: new Date('2026-07-11T09:00:00.000Z'),
    updatedAt: new Date('2026-07-11T09:00:00.000Z'),
  };
}

describe('ticketSchema', () => {
  it('accepts a fully-populated valid ticket', () => {
    const result = ticketSchema.safeParse(validTicket());
    expect(result.success).toBe(true);
  });

  it('rejects a ticket with an empty title', () => {
    const result = ticketSchema.safeParse({ ...validTicket(), title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a ticket with a whitespace-only title', () => {
    const result = ticketSchema.safeParse({ ...validTicket(), title: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a ticket with a non-uuid id', () => {
    const result = ticketSchema.safeParse({
      ...validTicket(),
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a ticket with an unrecognised board status', () => {
    const result = ticketSchema.safeParse({
      ...validTicket(),
      status: 'InProgress',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a ticket with an unrecognised severity', () => {
    const result = ticketSchema.safeParse({
      ...validTicket(),
      severity: 'Urgent',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a ticket missing projectKey', () => {
    const ticket = validTicket();
    delete ticket.projectKey;
    const result = ticketSchema.safeParse(ticket);
    expect(result.success).toBe(false);
  });

  it('rejects a ticket whose updatedAt predates its createdAt', () => {
    const result = ticketSchema.safeParse({
      ...validTicket(),
      createdAt: new Date('2026-07-11T09:00:00.000Z'),
      updatedAt: new Date('2026-07-10T09:00:00.000Z'),
    });
    expect(result.success).toBe(false);
  });

  it('property: any ticket built from valid field arbitraries always parses', () => {
    const nonBlankString = fc.string({ minLength: 1 }).filter(isNotBlank);

    const validTicketArbitrary = fc.record({
      id: fc.uuid(),
      projectKey: nonBlankString,
      title: nonBlankString,
      status: fc.constantFrom(
        'Backlog',
        'Brief',
        'Plan',
        'Build',
        'Review',
        'Done',
        'Cancelled',
      ),
      severity: fc.constantFrom('Critical', 'High', 'Medium', 'Low'),
      createdAt: fc.date({ noInvalidDate: true }),
    });

    fc.assert(
      fc.property(validTicketArbitrary, (fields) => {
        const result = ticketSchema.safeParse({
          ...fields,
          updatedAt: fields.createdAt,
        });
        expect(result.success).toBe(true);
      }),
    );
  });

  it('property: omitting any single required field always fails to parse', () => {
    const requiredFields = [
      'id',
      'projectKey',
      'title',
      'status',
      'severity',
      'createdAt',
      'updatedAt',
    ] as const;

    fc.assert(
      fc.property(fc.constantFrom(...requiredFields), (fieldToOmit) => {
        const ticket = validTicket();
        delete ticket[fieldToOmit];
        const result = ticketSchema.safeParse(ticket);
        expect(result.success).toBe(false);
      }),
    );
  });
});
