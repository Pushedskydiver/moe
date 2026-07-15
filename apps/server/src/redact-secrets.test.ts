import { describe, expect, it } from 'vitest';

import { redactSecrets } from './redact-secrets.js';

describe('redactSecrets', () => {
  it('replaces a top-level secret key with a redaction marker', () => {
    const result = redactSecrets(
      { id: 'sarah', slackBotToken: 'xoxb-real-token' },
      ['slackBotToken'],
    );

    expect(result).toEqual({ id: 'sarah', slackBotToken: '[REDACTED]' });
  });

  it('leaves non-secret keys untouched', () => {
    const result = redactSecrets({ id: 'sarah', port: 3000 }, [
      'slackBotToken',
    ]);

    expect(result).toEqual({ id: 'sarah', port: 3000 });
  });

  it('redacts a secret key nested inside another object', () => {
    const result = redactSecrets(
      { config: { id: 'sarah', slackSigningSecret: 'real-secret' } },
      ['slackSigningSecret'],
    );

    expect(result).toEqual({
      config: { id: 'sarah', slackSigningSecret: '[REDACTED]' },
    });
  });

  it('redacts secret keys inside array elements', () => {
    const result = redactSecrets({ items: [{ slackBotToken: 'real-token' }] }, [
      'slackBotToken',
    ]);

    expect(result).toEqual({ items: [{ slackBotToken: '[REDACTED]' }] });
  });

  it('passes through primitives and non-plain-object values unchanged', () => {
    expect(redactSecrets('plain string', ['slackBotToken'])).toBe(
      'plain string',
    );
    expect(redactSecrets(42, ['slackBotToken'])).toBe(42);
    expect(redactSecrets(null, ['slackBotToken'])).toBe(null);
  });
});
