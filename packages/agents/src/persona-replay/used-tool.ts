import type { ReplayFixture } from './replay-fixture.js';

/**
 * Extracted to `persona-replay/` once a second persona's `scenarios.ts` needed the identical
 * helper (`docs/CONVENTIONS.md` §`shared/` discipline's 2+-sibling-consumer trigger) — Sarah's
 * and Marcus's own copies were verbatim-identical.
 */
export function usedTool(fixture: ReplayFixture, name: string): boolean {
  return (
    fixture.result.ok &&
    'toolUses' in fixture.result &&
    fixture.result.toolUses.some((use) => use.name === name)
  );
}
