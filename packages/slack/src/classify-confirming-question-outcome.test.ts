import { describe, expect, it } from 'vitest';

import { classifyConfirmingQuestionOutcome } from './classify-confirming-question-outcome.js';

describe('classifyConfirmingQuestionOutcome', () => {
  // BUILD_PLAN 6.1e's own live-fleet check found this empirically: a real 👍 click in the Slack
  // UI reports `reaction: "+1"`, not `"thumbsup"` — a real, captured `reaction_added` event
  // payload against Marcus's real Slack app, not a guess. The 'thumbsup'/'thumbsdown' cases below
  // are kept too (harmless to accept both — some other API-driven `reactions.add` call, or a
  // different Slack client, could plausibly still send the literal alias), but '+1'/'-1' are the
  // names a real human click actually produces and must classify correctly.
  it("classifies '+1' (👍, the real Slack event short-name) as yes", () => {
    expect(classifyConfirmingQuestionOutcome('+1')).toBe('yes');
  });

  it("classifies '-1' (👎, the real Slack event short-name) as no", () => {
    expect(classifyConfirmingQuestionOutcome('-1')).toBe('no');
  });

  it("also classifies 'thumbsup' (👍) as yes", () => {
    expect(classifyConfirmingQuestionOutcome('thumbsup')).toBe('yes');
  });

  it("also classifies 'thumbsdown' (👎) as no", () => {
    expect(classifyConfirmingQuestionOutcome('thumbsdown')).toBe('no');
  });

  it('returns undefined for an unrelated reaction', () => {
    expect(
      classifyConfirmingQuestionOutcome('white_check_mark'),
    ).toBeUndefined();
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
