import type { ReplayFixture } from './replay-fixture.js';

/**
 * Extracted to `persona-replay/` once a third persona's `scenarios.ts` needed the identical
 * helper (`docs/CONVENTIONS.md` §`shared/` discipline's 2+-sibling-consumer trigger) — Sarah's,
 * Maya's, and Marcus's own copies were verbatim-identical.
 */
export function dmReplyText(fixture: ReplayFixture): string | undefined {
  return fixture.result.ok && 'reply' in fixture.result
    ? fixture.result.reply
    : undefined;
}
