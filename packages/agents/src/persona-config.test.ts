import { describe, expect, it } from 'vitest';

import { parsePersonaConfig } from './persona-config.js';

describe('parsePersonaConfig', () => {
  it('returns ok:true with a parsed config for valid env input', () => {
    const result = parsePersonaConfig({
      MOE_PERSONA_ID: 'sarah',
      MOE_SLACK_BOT_TOKEN: 'xoxb-test-token',
      MOE_SLACK_SIGNING_SECRET: 'test-signing-secret',
    });

    expect(result).toEqual({
      ok: true,
      config: {
        id: 'sarah',
        slackBotToken: 'xoxb-test-token',
        slackSigningSecret: 'test-signing-secret',
      },
    });
  });

  it('returns ok:false when MOE_PERSONA_ID is missing', () => {
    const result = parsePersonaConfig({
      MOE_SLACK_BOT_TOKEN: 'xoxb-test-token',
      MOE_SLACK_SIGNING_SECRET: 'test-signing-secret',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_PERSONA_ID is not a roster member', () => {
    const result = parsePersonaConfig({
      MOE_PERSONA_ID: 'maya',
      MOE_SLACK_BOT_TOKEN: 'xoxb-test-token',
      MOE_SLACK_SIGNING_SECRET: 'test-signing-secret',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_SLACK_BOT_TOKEN is missing', () => {
    const result = parsePersonaConfig({
      MOE_PERSONA_ID: 'sarah',
      MOE_SLACK_SIGNING_SECRET: 'test-signing-secret',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_SLACK_SIGNING_SECRET is blank', () => {
    const result = parsePersonaConfig({
      MOE_PERSONA_ID: 'sarah',
      MOE_SLACK_BOT_TOKEN: 'xoxb-test-token',
      MOE_SLACK_SIGNING_SECRET: '',
    });

    expect(result.ok).toBe(false);
  });

  it('returns a typed, non-empty list of issues in the ok:false error channel', () => {
    const result = parsePersonaConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-config');
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
