import { describe, expect, it } from 'vitest';

import { classOfServiceSchema } from './class-of-service.js';

describe('classOfServiceSchema', () => {
  it.each(['Standard', 'Expedite'] as const)(
    'accepts %s as a valid class of service',
    (classOfService) => {
      expect(classOfServiceSchema.safeParse(classOfService).success).toBe(true);
    },
  );

  it('rejects a class of service outside the classification', () => {
    const result = classOfServiceSchema.safeParse('Urgent');
    expect(result.success).toBe(false);
  });

  it('rejects a lowercase variant of a valid class of service', () => {
    const result = classOfServiceSchema.safeParse('standard');
    expect(result.success).toBe(false);
  });
});
