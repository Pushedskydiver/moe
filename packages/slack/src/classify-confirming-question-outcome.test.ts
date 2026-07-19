import { describe, expect, it } from 'vitest';

import { classifyConfirmingQuestionOutcome } from './classify-confirming-question-outcome.js';

describe('classifyConfirmingQuestionOutcome', () => {
  it("classifies 'thumbsup' (👍) as yes", () => {
    expect(classifyConfirmingQuestionOutcome('thumbsup')).toBe('yes');
  });

  it("classifies 'thumbsdown' (👎) as no", () => {
    expect(classifyConfirmingQuestionOutcome('thumbsdown')).toBe('no');
  });

  it('returns undefined for an unrelated reaction', () => {
    expect(
      classifyConfirmingQuestionOutcome('white_check_mark'),
    ).toBeUndefined();
  });

  it('is case-sensitive to the exact Slack short-name — a near-miss does not match', () => {
    expect(classifyConfirmingQuestionOutcome('+1')).toBeUndefined();
  });

  // Same class of gotcha `classifyReactionOutcome` already guards against (DA review, chunk
  // 3.4a-ii) — a custom Slack workspace emoji can be named almost anything, including a JS
  // Object.prototype member name.
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    "returns undefined for the prototype-chain property name '%s' (a plausible custom-emoji short-name)",
    (reactionName) => {
      expect(classifyConfirmingQuestionOutcome(reactionName)).toBeUndefined();
    },
  );
});
