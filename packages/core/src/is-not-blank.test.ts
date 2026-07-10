import { describe, expect, it } from 'vitest';

import { isNotBlank } from './is-not-blank.js';

describe('isNotBlank', () => {
  it('accepts a string with real content', () => {
    expect(isNotBlank('chief-clancy')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isNotBlank('')).toBe(false);
  });

  it('rejects a whitespace-only string', () => {
    expect(isNotBlank('   ')).toBe(false);
  });
});
