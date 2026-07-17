import { describe, expect, it } from 'vitest';

import {
  buildPersonaSystemPrompt,
  PLACEHOLDER_SYSTEM_PROMPT,
} from './placeholder-system-prompt.js';

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

  it('names no roster persona — this is the no-persona-context fallback, not the persona voice (Stage 5 gate)', () => {
    const lower = PLACEHOLDER_SYSTEM_PROMPT.toLowerCase();
    ROSTER_NAMES.forEach((name) => {
      expect(lower).not.toContain(name);
    });
  });
});

describe('buildPersonaSystemPrompt', () => {
  it('names the given persona, capitalized, as its identity in this context', () => {
    expect(buildPersonaSystemPrompt('sarah').toLowerCase()).toContain('sarah');
    expect(buildPersonaSystemPrompt('sarah')).toContain('Sarah');
  });

  it('produces a different prompt per persona, not a shared hardcoded name', () => {
    expect(buildPersonaSystemPrompt('sarah')).not.toEqual(
      buildPersonaSystemPrompt('marcus'),
    );
    expect(buildPersonaSystemPrompt('marcus')).toContain('Marcus');
  });

  it("tells the model not to correct someone who uses its name — doesn't deny the persona identity", () => {
    const lower = buildPersonaSystemPrompt('sarah').toLowerCase();
    expect(lower).toContain('no need to correct');
  });

  it('does not claim a defined personality or voice — that stays Stage 5', () => {
    const lower = buildPersonaSystemPrompt('sarah').toLowerCase();
    expect(lower).toContain("don't have a defined personality or voice");
    expect(lower).not.toContain('you have a personality');
    expect(lower).not.toContain('your personality is');
  });

  it('does not claim to have or lack memory of past conversations — that depends on what history the caller forwards, not a static claim in the prompt', () => {
    const lower = buildPersonaSystemPrompt('sarah').toLowerCase();
    expect(lower).not.toContain('memory');
  });

  it('instructs the model to call report_status for a status claim rather than stating it directly (BUILD_PLAN 2.5)', () => {
    const lower = buildPersonaSystemPrompt('sarah').toLowerCase();
    expect(lower).toContain('report_status');
  });
});
