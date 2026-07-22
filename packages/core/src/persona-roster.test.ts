import { describe, expect, it } from 'vitest';

import { PERSONA_ROSTER, personaIdSchema } from './persona-roster.js';

describe('personaIdSchema', () => {
  it('accepts every confirmed roster id', () => {
    const ids = ['sarah', 'marcus', 'riley', 'priya', 'dom', 'theo', 'nia'];

    expect(ids.every((id) => personaIdSchema.safeParse(id).success)).toBe(true);
  });

  it('rejects a non-roster id', () => {
    expect(personaIdSchema.safeParse('maya').success).toBe(false);
  });
});

describe('PERSONA_ROSTER', () => {
  it('has a displayName and role for every roster id, matching docs/PERSONAS.md', () => {
    expect(PERSONA_ROSTER).toEqual({
      sarah: { displayName: 'Sarah', role: 'PM' },
      marcus: { displayName: 'Marcus', role: 'Architect' },
      riley: { displayName: 'Riley', role: 'Engineer' },
      priya: { displayName: 'Priya', role: 'QA' },
      dom: { displayName: 'Dom', role: 'Reviewer' },
      theo: { displayName: 'Theo', role: 'Researcher' },
      nia: { displayName: 'Nia', role: 'Scrum Master' },
    });
  });
});
