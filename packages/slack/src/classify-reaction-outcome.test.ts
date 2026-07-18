import { describe, expect, it } from 'vitest';

import { classifyReactionOutcome } from './classify-reaction-outcome.js';

describe('classifyReactionOutcome', () => {
  it("classifies 'white_check_mark' (✅) as commit", () => {
    expect(classifyReactionOutcome('white_check_mark')).toBe('commit');
  });

  it("classifies 'repeat' (🔁) as redo", () => {
    expect(classifyReactionOutcome('repeat')).toBe('redo');
  });

  it("classifies 'package' (📦) as park", () => {
    expect(classifyReactionOutcome('package')).toBe('park');
  });

  it('returns undefined for an unrelated reaction', () => {
    expect(classifyReactionOutcome('thumbsup')).toBeUndefined();
  });

  it('is case-sensitive to the exact Slack short-name — a near-miss does not match', () => {
    expect(classifyReactionOutcome('arrows_counterclockwise')).toBeUndefined();
  });

  // DA review, chunk 3.4a-ii: a custom Slack workspace emoji can be named almost anything,
  // including a JS Object.prototype member name — a plain object-literal lookup would answer these
  // with a truthy prototype-chain value instead of undefined, misdispatching as a real outcome.
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    "returns undefined for the prototype-chain property name '%s' (a plausible custom-emoji short-name)",
    (reactionName) => {
      expect(classifyReactionOutcome(reactionName)).toBeUndefined();
    },
  );
});
