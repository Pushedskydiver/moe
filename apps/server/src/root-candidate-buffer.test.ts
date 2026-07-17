import { describe, expect, it } from 'vitest';

import { makeRootCandidateBuffer } from './root-candidate-buffer.js';

describe('makeRootCandidateBuffer', () => {
  it('returns a recorded candidate when a later message matches its ts', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordCandidate('C1', 'T1', 'what do you think?');

    expect(buffer.takeIfMatches('C1', 'T1')).toEqual({
      text: 'what do you think?',
    });
  });

  it('includes the recorded reply when one was attached before the match', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordCandidate('C1', 'T1', 'what do you think?');
    buffer.recordReply('C1', 'T1', 'good idea, let’s do it');

    expect(buffer.takeIfMatches('C1', 'T1')).toEqual({
      text: 'what do you think?',
      replyText: 'good idea, let’s do it',
    });
  });

  it('keeps only the most recent candidate per channel', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordCandidate('C1', 'T1', 'first message');
    buffer.recordCandidate('C1', 'T2', 'second message');

    expect(buffer.takeIfMatches('C1', 'T1')).toBeUndefined();
    expect(buffer.takeIfMatches('C1', 'T2')).toEqual({
      text: 'second message',
    });
  });

  it('returns undefined when no candidate matches the given ts', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordCandidate('C1', 'T1', 'a message');

    expect(buffer.takeIfMatches('C1', 'T2')).toBeUndefined();
  });

  it('returns undefined for a channel with no recorded candidate at all', () => {
    const buffer = makeRootCandidateBuffer();

    expect(buffer.takeIfMatches('C1', 'T1')).toBeUndefined();
  });

  it('does not re-match a candidate a second time after it has been consumed', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordCandidate('C1', 'T1', 'a message');
    buffer.takeIfMatches('C1', 'T1');

    expect(buffer.takeIfMatches('C1', 'T1')).toBeUndefined();
  });

  it('treats recordReply as a no-op when no candidate has been recorded yet', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordReply('C1', 'T1', 'a reply with nothing to attach to');

    expect(buffer.takeIfMatches('C1', 'T1')).toBeUndefined();
  });

  it('treats recordReply as a no-op when its ts no longer matches the current candidate, without corrupting the newer one', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordCandidate('C1', 'T1', 'first message');
    buffer.recordCandidate('C1', 'T2', 'second message');
    buffer.recordReply('C1', 'T1', 'a stale reply to the first message');

    expect(buffer.takeIfMatches('C1', 'T2')).toEqual({
      text: 'second message',
    });
  });

  it('returns replyText undefined when takeIfMatches consumes a candidate before its reply has landed', () => {
    const buffer = makeRootCandidateBuffer();

    buffer.recordCandidate('C1', 'T1', 'a message');
    const taken = buffer.takeIfMatches('C1', 'T1');

    expect(taken).toEqual({ text: 'a message' });
    expect(taken?.replyText).toBeUndefined();
  });
});
