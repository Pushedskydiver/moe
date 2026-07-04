import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'slack',
    include: ['src/**/*.test.ts'],
  },
});
