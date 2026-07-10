import { describe, expect, it } from 'vitest';

import {
  boardStatusSchema,
  projectKeySchema,
  severitySchema,
  ticketSchema,
} from './index.js';

describe('@moe/core public API', () => {
  it('re-exports the domain schemas', () => {
    expect(boardStatusSchema.safeParse('Backlog').success).toBe(true);
    expect(projectKeySchema.safeParse('chief-clancy').success).toBe(true);
    expect(severitySchema.safeParse('Medium').success).toBe(true);
    expect(
      ticketSchema.safeParse({
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        projectKey: 'chief-clancy',
        title: 'A ticket',
        status: 'Backlog',
        severity: 'Medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).success,
    ).toBe(true);
  });
});
