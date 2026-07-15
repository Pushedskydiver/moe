import { main } from './main.js';

export function getPackageName(): string {
  return '@moe/server';
}

// Boot only when this file is run directly (`node dist/index.js`), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
