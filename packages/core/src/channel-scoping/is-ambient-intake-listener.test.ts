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
    const others = Object.keys(PERSONA_ROSTER).filter(
      (id) => id !== AMBIENT_INTAKE_PERSONA_ID,
    );

    // Asserted over the real roster rather than a hand-written list, so activating a ninth
    // persona cannot quietly leave a second ambient classifier running in a shared channel —
    // exactly the failure BUILD_PLAN 5.2a exists to close, which only appeared once N went 1 → 8.
    expect(others).toHaveLength(7);
    for (const id of others) {
      expect(isAmbientIntakeListener(id as never)).toBe(false);
    }
  });

  it('names Sarah as the designated listener, per VISION §5.3', () => {
    // Pinned as a value, not just via the predicate: §5.3 settles *who* owns ambient intake, and
    // this constant is the single place that decision is encoded in code.
    expect(AMBIENT_INTAKE_PERSONA_ID).toBe('sarah');
  });

  it('designates a persona that actually exists in the roster', () => {
    // Guards the one way this constant could silently disable ambient intake fleet-wide: a typo,
    // or a rename during a future roster change, would make the predicate false for all eight
    // processes and no message would ever be classified again.
    expect(AMBIENT_INTAKE_PERSONA_ID in PERSONA_ROSTER).toBe(true);
  });
});
