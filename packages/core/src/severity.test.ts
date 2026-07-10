import { describe, expect, it } from 'vitest';

import { severitySchema } from './severity.js';

describe('severitySchema', () => {
  it.each(['Critical', 'High', 'Medium', 'Low'] as const)(
    'accepts %s as a valid severity',
    (severity) => {
      expect(severitySchema.safeParse(severity).success).toBe(true);
    },
  );

  it('rejects a severity outside the classification', () => {
    const result = severitySchema.safeParse('Urgent');
    expect(result.success).toBe(false);
  });

  it('rejects a lowercase variant of a valid severity', () => {
    const result = severitySchema.safeParse('critical');
    expect(result.success).toBe(false);
  });
});
