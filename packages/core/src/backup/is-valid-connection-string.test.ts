import { describe, expect, it } from 'vitest';

import { isValidConnectionString } from './is-valid-connection-string.js';

describe('isValidConnectionString', () => {
  it('accepts a well-formed postgres connection string', () => {
    expect(
      isValidConnectionString('postgres://user:pass@localhost:5432/db'),
    ).toBe(true);
  });

  it('rejects a malformed value instead of letting URL parsing throw', () => {
    expect(isValidConnectionString('not-a-connection-string')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidConnectionString('')).toBe(false);
  });
});
