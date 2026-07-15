import { describe, expect, it } from 'vitest';

import { resolvePort } from './resolve-port.js';

describe('resolvePort', () => {
  it('defaults to 8080 when PORT is unset', () => {
    expect(resolvePort({})).toBe(8080);
  });

  it('uses PORT when it is a valid number', () => {
    expect(resolvePort({ PORT: '3000' })).toBe(3000);
  });

  it('accepts PORT=0 (OS-assigned port), not the default', () => {
    expect(resolvePort({ PORT: '0' })).toBe(0);
  });

  it('falls back to 8080 when PORT is not a number', () => {
    expect(resolvePort({ PORT: 'not-a-number' })).toBe(8080);
  });
});
