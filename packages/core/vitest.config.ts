import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'core',
    include: ['src/**/*.test.ts'],
    // ticket-lifecycle/*.test.ts share one real Postgres database (docs/TESTING.md: prefer a
    // real test DB) — vitest's default per-file parallelism races them against the same tables.
    // Revisit with per-file schema isolation if suite runtime becomes a real problem; not yet.
    fileParallelism: false,
  },
});
