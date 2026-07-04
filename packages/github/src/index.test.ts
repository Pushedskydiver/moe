import { describe, expect, it } from 'vitest';

import { getPackageName } from './index.js';

describe('getPackageName', () => {
  it('returns the package name', () => {
    expect(getPackageName()).toBe('@moe/github');
  });
});
