import { describe, expect, it } from 'vitest';

import { projectKeySchema } from './project-key.js';

describe('projectKeySchema', () => {
  it('accepts a non-empty project key', () => {
    expect(projectKeySchema.safeParse('chief-clancy').success).toBe(true);
  });

  it('rejects an empty project key', () => {
    const result = projectKeySchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects a whitespace-only project key', () => {
    const result = projectKeySchema.safeParse('   ');
    expect(result.success).toBe(false);
  });

  it('rejects a non-string project key', () => {
    const result = projectKeySchema.safeParse(42);
    expect(result.success).toBe(false);
  });
});
