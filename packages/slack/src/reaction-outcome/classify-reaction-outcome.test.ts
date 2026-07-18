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
});
