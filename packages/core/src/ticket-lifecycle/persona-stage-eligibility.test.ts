import { describe, expect, it } from 'vitest';

import { PERSONA_CLAIMABLE_STAGES } from './persona-stage-eligibility.js';

describe('PERSONA_CLAIMABLE_STAGES', () => {
  it('maps every roster id to its claimable board statuses, matching BUILD_PLAN.md 6.1a-i and board-status.ts', () => {
    expect(PERSONA_CLAIMABLE_STAGES).toEqual({
      sarah: ['Brief'],
      marcus: ['Plan'],
      riley: ['Build'],
      priya: [],
      dom: ['Review'],
      theo: [],
      nia: [],
      maya: [],
    });
  });
});
