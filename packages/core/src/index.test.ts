import { describe, expect, it } from 'vitest';

import {
  boardStatusSchema,
  classOfServiceSchema,
  composeStatus,
  projectKeySchema,
  severitySchema,
  statusClaimSchema,
  ticketSchema,
} from './index.js';

describe('@moe/core public API', () => {
  it('re-exports the domain schemas', () => {
    expect(boardStatusSchema.safeParse('Backlog').success).toBe(true);
    expect(projectKeySchema.safeParse('chief-clancy').success).toBe(true);
    expect(severitySchema.safeParse('Medium').success).toBe(true);
    expect(classOfServiceSchema.safeParse('Standard').success).toBe(true);
    expect(
      ticketSchema.safeParse({
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        projectKey: 'chief-clancy',
        title: 'A ticket',
        status: 'Backlog',
        severity: 'Medium',
        classOfService: 'Standard',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).success,
    ).toBe(true);
    expect(
      statusClaimSchema.safeParse({
        claim: 'tests passed',
        toolCallId: 'toolu_01abc',
        toolOutputSnippet: '54 passed (54)',
        timestamp: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });

  it('re-exports composeStatus', () => {
    expect(composeStatus({ claim: 'tests passed', timestamp: '' }).kind).toBe(
      'not-yet-verified',
    );
  });
});
