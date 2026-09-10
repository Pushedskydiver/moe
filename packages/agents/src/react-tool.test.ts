import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { parseReactInput, REACT_TOOL, REACT_TOOL_NAME } from './react-tool.js';

describe('REACT_TOOL', () => {
  it('is named react, matching REACT_TOOL_NAME', () => {
    expect(REACT_TOOL.name).toBe('react');
    expect(REACT_TOOL.name).toBe(REACT_TOOL_NAME);
  });

  it('requires a reaction input, restricted to the two supported reactions', () => {
    expect(REACT_TOOL.input_schema.required).toEqual(['reaction']);
    expect(REACT_TOOL.input_schema.properties).toMatchObject({
      reaction: { type: 'string', enum: ['eyes', 'white_check_mark'] },
    });
  });
});

describe('parseReactInput', () => {
  it('extracts a valid "eyes" reaction', () => {
    expect(parseReactInput({ reaction: 'eyes' })).toBe('eyes');
  });

  it('extracts a valid "white_check_mark" reaction', () => {
    expect(parseReactInput({ reaction: 'white_check_mark' })).toBe(
      'white_check_mark',
    );
  });

  it('returns undefined when reaction is missing', () => {
    expect(parseReactInput({})).toBeUndefined();
  });

  it('returns undefined when reaction is not one of the supported values', () => {
    expect(parseReactInput({ reaction: 'thumbsup' })).toBeUndefined();
  });

  it('returns undefined for non-object input', () => {
    expect(parseReactInput('not an object')).toBeUndefined();
    expect(parseReactInput(null)).toBeUndefined();
    expect(parseReactInput(undefined)).toBeUndefined();
  });

  it('property: never throws on arbitrary input, and only ever returns one of the two supported reactions or undefined', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = parseReactInput(input);
        expect(
          result === undefined ||
            result === 'eyes' ||
            result === 'white_check_mark',
        ).toBe(true);
      }),
    );
  });
});
