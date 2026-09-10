import { describe, expect, it } from 'vitest';

import {
  isGenuineReadyClaim,
  opensWithIncompleteness,
} from './calibrated-ambiguity-helpers.js';

describe('opensWithIncompleteness', () => {
  // Callers always lowercase the reply first (`scenarios.ts`'s own
  // `dmReplyText(fixture)?.toLowerCase()`) — the regex itself has no `i` flag, so these fixtures
  // are pre-lowercased to match real call-site usage.
  it('returns true when the reply opens with a stalling admission', () => {
    expect(
      opensWithIncompleteness(
        'not enough here to plan against yet. what does the retry helper actually do?',
      ),
    ).toBe(true);
  });

  it('returns false when a real plan commits to an approach up front', () => {
    expect(
      opensWithIncompleteness(
        "I'll use retryWithBackoff. It's a straightforward fit here.",
      ),
    ).toBe(false);
  });

  it('does not flag "still waiting"/"pending confirmation" mentioned as a trailing caveat, not the lede (R6)', () => {
    // A whole-body scan would wrongly match "still waiting" here — the opening-sentence scope
    // this function actually uses correctly does not, since the plan commits to an approach
    // before that caveat appears.
    const reply =
      "i'll use retrywithbackoff for this. we're still waiting on one config value from ops, " +
      'but that does not block starting.';
    expect(opensWithIncompleteness(reply)).toBe(false);
  });

  it('scans a bounded window rather than the whole reply when no sentence boundary exists (R7)', () => {
    const noBoundary = `${'x'.repeat(250)} not enough information to plan against`;
    expect(opensWithIncompleteness(noBoundary)).toBe(false);
  });
});

describe('isGenuineReadyClaim', () => {
  it('returns true for a plain, unconditional ready claim', () => {
    expect(isGenuineReadyClaim('ready to hand off to riley')).toBe(true);
  });

  it('returns false for a negated "not ready" claim', () => {
    expect(isGenuineReadyClaim('not ready yet, still confirming retries')).toBe(
      false,
    );
  });

  it('returns false when an otherwise-ready claim also names an unnegated "blocked" item (R4/R5)', () => {
    // Must contain unnegated "ready" too, or the function short-circuits on the `ready` check
    // before ever reaching the `unnegatedBlocked` guard this test exists to exercise.
    expect(
      isGenuineReadyClaim(
        'ready to hand off — flagging that a related ticket is blocked on ops, does not affect ' +
          'this one',
      ),
    ).toBe(false);
  });

  it('returns false for a claim conditional on a future event (R7)', () => {
    expect(
      isGenuineReadyClaim(
        'ready once confirmed by riley — not final before that',
      ),
    ).toBe(false);
  });

  it('returns true for a ready claim that merely names a peripheral open detail (R7)', () => {
    expect(
      isGenuineReadyClaim(
        'ready to hand off — one open detail is which retry helper to use, not blocking',
      ),
    ).toBe(true);
  });
});
