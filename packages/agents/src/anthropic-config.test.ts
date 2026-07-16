import { describe, expect, it } from 'vitest';

import { parseAnthropicConfig } from './anthropic-config.js';

describe('parseAnthropicConfig', () => {
  it('returns ok:true with a parsed config for valid env input', () => {
    const result = parseAnthropicConfig({
      MOE_ANTHROPIC_API_KEY: 'sk-ant-fake-key',
    });

    expect(result).toEqual({
      ok: true,
      config: {
        apiKey: 'sk-ant-fake-key',
      },
    });
  });

  it('returns ok:false when MOE_ANTHROPIC_API_KEY is missing', () => {
    const result = parseAnthropicConfig({});

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_ANTHROPIC_API_KEY is blank', () => {
    const result = parseAnthropicConfig({ MOE_ANTHROPIC_API_KEY: '' });

    expect(result.ok).toBe(false);
  });

  it('returns a typed, non-empty list of issues in the ok:false error channel', () => {
    const result = parseAnthropicConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-config');
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
