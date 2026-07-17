import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  parseStatusClaimInput,
  STATUS_CLAIM_TOOL,
  STATUS_CLAIM_TOOL_NAME,
} from './status-claim-tool.js';

describe('STATUS_CLAIM_TOOL', () => {
  it('is named report_status, matching STATUS_CLAIM_TOOL_NAME', () => {
    expect(STATUS_CLAIM_TOOL.name).toBe('report_status');
    expect(STATUS_CLAIM_TOOL.name).toBe(STATUS_CLAIM_TOOL_NAME);
  });

  it('requires a claim string input', () => {
    expect(STATUS_CLAIM_TOOL.input_schema.required).toEqual(['claim']);
    expect(STATUS_CLAIM_TOOL.input_schema.properties).toMatchObject({
      claim: { type: 'string' },
    });
  });
});

describe('parseStatusClaimInput', () => {
  it('extracts the claim string from a valid tool_use input', () => {
    expect(parseStatusClaimInput({ claim: 'finished the config update' })).toBe(
      'finished the config update',
    );
  });

  it('returns an empty string when claim is missing', () => {
    expect(parseStatusClaimInput({})).toBe('');
  });

  it('returns an empty string when claim is not a string', () => {
    expect(parseStatusClaimInput({ claim: 42 })).toBe('');
  });

  it('returns an empty string for non-object input', () => {
    expect(parseStatusClaimInput('not an object')).toBe('');
    expect(parseStatusClaimInput(null)).toBe('');
    expect(parseStatusClaimInput(undefined)).toBe('');
  });

  it('property: never throws on arbitrary input, and only ever returns the claim field verbatim or an empty string', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = parseStatusClaimInput(input);
        const expected =
          typeof input === 'object' &&
          input !== null &&
          !Array.isArray(input) &&
          typeof (input as Record<string, unknown>).claim === 'string'
            ? (input as Record<string, unknown>).claim
            : '';
        expect(result).toBe(expected);
      }),
    );
  });
});
