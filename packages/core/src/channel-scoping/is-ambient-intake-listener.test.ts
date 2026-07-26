import type { PersonaId } from '../persona-roster.js';

import { describe, expect, it } from 'vitest';

import { PERSONA_ROSTER } from '../persona-roster.js';
import {
  AMBIENT_INTAKE_PERSONA_ID,
  isAmbientIntakeListener,
} from './is-ambient-intake-listener.js';

describe('isAmbientIntakeListener', () => {
  it('accepts the designated intake persona', () => {
    expect(isAmbientIntakeListener('sarah')).toBe(true);
  });

  it('rejects every other persona in the roster', () => {
    const others = (Object.keys(PERSONA_ROSTER) as PersonaId[]).filter(
      (id) => id !== AMBIENT_INTAKE_PERSONA_ID,
    );

    // Two distinct guards, stated precisely rather than as one vague claim (DA review). The
    // `not.toContain(true)` pins that the predicate stays an equality check — broadening it is how
    // a second ambient classifier would appear in a shared channel, the failure 5.2a exists to
    // close. The `toHaveLength(7)` pins the roster size, so activating a ninth persona forces
    // someone to re-read this file rather than silently changing what "every other persona" means.
    expect(others).toHaveLength(7);
    expect(others.map((id) => isAmbientIntakeListener(id))).not.toContain(true);
  });

  it('names Sarah as the designated listener, per VISION §5.3', () => {
    // Pinned as a value, not just via the predicate: §5.3 settles *who* owns ambient intake, and
    // this constant is the single place that decision is encoded in code.
    expect(AMBIENT_INTAKE_PERSONA_ID).toBe('sarah');
  });

  it('designates a persona that actually exists in the roster', () => {
    // Cheap belt-and-braces, and deliberately not claimed as more than that (DA review): the
    // `PersonaId` annotation on the constant plus `Record<PersonaId, …>` on the roster already
    // make a typo or a rename a *compile* error, so this assertion is close to a type-level
    // tautology. The genuinely silent failure it does NOT catch is naming a *valid* persona whose
    // process is undeployed or absent from the work channels — ambient intake then stops
    // fleet-wide with nothing anywhere to notice. See the constant's own TSDoc.
    expect(AMBIENT_INTAKE_PERSONA_ID in PERSONA_ROSTER).toBe(true);
  });
});
