import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'agents',
    include: ['src/**/*.test.ts'],
  },
});
