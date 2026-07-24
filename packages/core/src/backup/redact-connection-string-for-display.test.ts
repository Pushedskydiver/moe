import { describe, expect, it } from 'vitest';

import { redactConnectionStringForDisplay } from './redact-connection-string-for-display.js';

describe('redactConnectionStringForDisplay', () => {
  it('strips the password but keeps host/user/database visible for operator verification', () => {
    const result = redactConnectionStringForDisplay(
      'postgres://myuser:my%40pass@ep-abc-123.eu-west-2.aws.neon.tech:5432/moe_dev?sslmode=require',
    );
    expect(result).toBe(
      'postgres://myuser@ep-abc-123.eu-west-2.aws.neon.tech:5432/moe_dev?sslmode=require',
    );
    expect(result).not.toContain('my%40pass');
  });
});
