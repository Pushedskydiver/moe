import { describe, expect, it } from 'vitest';

import { PERSONA_CLAIMABLE_STAGES } from './persona-stage-eligibility.js';

describe('PERSONA_CLAIMABLE_STAGES', () => {
  it('maps every roster id to its claimable board statuses, matching docs/PERSONAS.md/BUILD_PLAN.md', () => {
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
