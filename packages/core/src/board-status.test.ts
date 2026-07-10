import { describe, expect, it } from 'vitest';

import { boardStatusSchema } from './board-status.js';

describe('boardStatusSchema', () => {
  it.each([
    'Backlog',
    'Brief',
    'Plan',
    'Build',
    'Review',
    'Done',
    'Cancelled',
  ] as const)('accepts %s as a valid board status', (status) => {
    expect(boardStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects a status outside the lifecycle', () => {
    const result = boardStatusSchema.safeParse('InProgress');
    expect(result.success).toBe(false);
  });

  it('rejects a lowercase variant of a valid status', () => {
    const result = boardStatusSchema.safeParse('backlog');
    expect(result.success).toBe(false);
  });
});
