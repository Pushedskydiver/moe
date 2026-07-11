import type { StatusClaimCandidate } from './status-claim.js';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isNotBlank } from './is-not-blank.js';
import { composeStatus, statusClaimSchema } from './status-claim.js';

function validCandidate(): Record<string, unknown> {
  return {
    claim: 'tests passed',
    toolCallId: 'toolu_01abc',
    toolOutputSnippet: '54 passed (54)',
    timestamp: '2026-07-11T09:00:00.000Z',
  };
}

describe('statusClaimSchema', () => {
  it('accepts a fully-populated valid claim', () => {
    const result = statusClaimSchema.safeParse(validCandidate());
    expect(result.success).toBe(true);
  });

  it('rejects a claim with an empty claim string', () => {
    const result = statusClaimSchema.safeParse({
      ...validCandidate(),
      claim: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a claim with a whitespace-only toolCallId', () => {
    const result = statusClaimSchema.safeParse({
      ...validCandidate(),
      toolCallId: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a claim missing toolOutputSnippet', () => {
    const candidate = validCandidate();
    delete candidate.toolOutputSnippet;
    const result = statusClaimSchema.safeParse(candidate);
    expect(result.success).toBe(false);
  });

  it('rejects a claim with a non-ISO timestamp', () => {
    const result = statusClaimSchema.safeParse({
      ...validCandidate(),
      timestamp: 'yesterday',
    });
    expect(result.success).toBe(false);
  });
});

describe('composeStatus', () => {
  it('composes a grounded claim when evidence is fully populated', () => {
    const result = composeStatus(validCandidate() as StatusClaimCandidate);
    expect(result).toEqual({ kind: 'grounded', claim: validCandidate() });
  });

  it('falls back to not-yet-verified when toolCallId is missing', () => {
    const candidate = validCandidate();
    delete candidate.toolCallId;
    const result = composeStatus(candidate as StatusClaimCandidate);
    expect(result).toEqual({ kind: 'not-yet-verified' });
  });

  it('falls back to not-yet-verified when toolOutputSnippet is blank', () => {
    const result = composeStatus({
      ...validCandidate(),
      toolOutputSnippet: '   ',
    } as StatusClaimCandidate);
    expect(result).toEqual({ kind: 'not-yet-verified' });
  });

  it('falls back to not-yet-verified when the claim itself is blank', () => {
    const result = composeStatus({
      ...validCandidate(),
      claim: '',
    } as StatusClaimCandidate);
    expect(result).toEqual({ kind: 'not-yet-verified' });
  });

  it('falls back to not-yet-verified when the timestamp is malformed', () => {
    const result = composeStatus({
      ...validCandidate(),
      timestamp: 'yesterday',
    } as StatusClaimCandidate);
    expect(result).toEqual({ kind: 'not-yet-verified' });
  });

  it('property: any candidate built from valid field arbitraries always composes grounded', () => {
    const nonBlankString = fc.string({ minLength: 1 }).filter(isNotBlank);

    const validCandidateArbitrary = fc.record({
      claim: nonBlankString,
      toolCallId: nonBlankString,
      toolOutputSnippet: nonBlankString,
      // Bounded to keep every generated date's toISOString() in standard (4-digit-year) form.
      // An unbounded fc.date() can land beyond year 9999 or before year 0, where toISOString()
      // switches to extended notation (e.g. "+010000-01-01T00:00:00.000Z") that z.iso.datetime()
      // correctly rejects — a spurious failure unrelated to the grounding property under test.
      // The lower bound (epoch, not calendar year 0) is stricter than the bug requires, but no
      // real status claim will ever carry a pre-1970 timestamp.
      timestamp: fc
        .date({
          noInvalidDate: true,
          min: new Date(0),
          max: new Date('9999-12-31T23:59:59.999Z'),
        })
        .map((date) => date.toISOString()),
    });

    fc.assert(
      fc.property(validCandidateArbitrary, (candidate) => {
        const result = composeStatus(candidate);
        expect(result.kind).toBe('grounded');
      }),
    );
  });

  it('property: omitting any single evidence field always falls back to not-yet-verified', () => {
    const evidenceFields = ['toolCallId', 'toolOutputSnippet'] as const;

    fc.assert(
      fc.property(fc.constantFrom(...evidenceFields), (fieldToOmit) => {
        const candidate = validCandidate();
        delete candidate[fieldToOmit];
        const result = composeStatus(candidate as StatusClaimCandidate);
        expect(result).toEqual({ kind: 'not-yet-verified' });
      }),
    );
  });
});
