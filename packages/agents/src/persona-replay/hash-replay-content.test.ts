import { describe, expect, it } from 'vitest';

import { hashReplayContent } from './hash-replay-content.js';

describe('hashReplayContent', () => {
  it('returns the same hash for the same content', () => {
    expect(hashReplayContent('hello world')).toBe(
      hashReplayContent('hello world'),
    );
  });

  it('returns a different hash for different content', () => {
    expect(hashReplayContent('hello world')).not.toBe(
      hashReplayContent('hello there'),
    );
  });

  it('returns a 64-character lowercase hex string (sha256)', () => {
    const hash = hashReplayContent('anything');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is sensitive to a single trailing character', () => {
    expect(hashReplayContent('abc')).not.toBe(hashReplayContent('abc '));
  });
});
