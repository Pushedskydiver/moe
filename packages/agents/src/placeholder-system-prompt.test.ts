import { describe, expect, it } from 'vitest';

import { PLACEHOLDER_SYSTEM_PROMPT } from './placeholder-system-prompt.js';

const ROSTER_NAMES = [
  'sarah',
  'marcus',
  'riley',
  'priya',
  'dom',
  'theo',
  'nia',
];

describe('PLACEHOLDER_SYSTEM_PROMPT', () => {
  it('is non-empty', () => {
    expect(PLACEHOLDER_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('names no roster persona — this is explicitly not the persona voice (Stage 5 gate)', () => {
    const lower = PLACEHOLDER_SYSTEM_PROMPT.toLowerCase();
    ROSTER_NAMES.forEach((name) => {
      expect(lower).not.toContain(name);
    });
  });
});
