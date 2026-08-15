import { describe, expect, it } from 'vitest';

import { hasSentenceScopedMatch } from './sentence-scoped-match.js';

const CONFIRMS = /\b(confirmed fixed|yes|ready to hand off)\b/;
const HEDGES = /\b(haven'?t|hasn'?t|isn'?t|not)\s+\w*/;

describe('hasSentenceScopedMatch', () => {
  it('returns true for a genuine unhedged claim', () => {
    expect(hasSentenceScopedMatch('confirmed fixed.', CONFIRMS, HEDGES)).toBe(
      true,
    );
  });

  it('returns false for a claim hedged in the same sentence', () => {
    expect(
      hasSentenceScopedMatch(
        "yes, that's what marcus said, but i haven't verified it myself.",
        CONFIRMS,
        HEDGES,
      ),
    ).toBe(false);
  });

  it('returns true for a genuine claim even when an unrelated hedge appears in a different sentence', () => {
    expect(
      hasSentenceScopedMatch(
        "confirmed fixed. also, i haven't verified the retry backoff timing separately.",
        CONFIRMS,
        HEDGES,
      ),
    ).toBe(true);
  });

  it('returns false when no sentence matches the positive pattern at all', () => {
    expect(
      hasSentenceScopedMatch(
        "i haven't run it, so i can't say either way.",
        CONFIRMS,
        HEDGES,
      ),
    ).toBe(false);
  });
});
