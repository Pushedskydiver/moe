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

  it('a topic-anchored negation is not tripped by an unrelated aside sharing the same sentence via a generic connective', () => {
    // The cheap, high-confidence half of the compound-clause gap named in this module's own doc
    // comment: a bare `but`/`however`/`though` in `negationRe` would mask this; a topic-anchored
    // one (here, "haven't ... verified") correctly doesn't, because the aside never mentions
    // anything the positive claim actually depends on.
    expect(
      hasSentenceScopedMatch(
        "confirmed fixed, but i'm heading to lunch now, will get back to you later.",
        CONFIRMS,
        HEDGES,
      ),
    ).toBe(true);
  });

  it('known limitation: a topically-similar hedge about an unrelated sub-detail in the same compound sentence still masks a genuine claim', () => {
    // Documented, not silently accepted — see this module's own doc comment. "confirmed fixed"
    // is a real, standalone claim; "haven't verified the retry timing" hedges a different
    // sub-detail, but shares enough vocabulary with HEDGES that sentence-scoping alone can't
    // tell the two apart without actual semantic understanding of what qualifies what.
    expect(
      hasSentenceScopedMatch(
        "confirmed fixed, but i haven't verified the retry timing separately.",
        CONFIRMS,
        HEDGES,
      ),
    ).toBe(false);
  });
});
