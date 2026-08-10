import type { ReplayFixture } from './replay-fixture.js';

/**
 * Extracted to `persona-replay/` once a 4th persona's `scenarios.ts` needed the identical helper
 * (`docs/CONVENTIONS.md` §`shared/` discipline's 2+-sibling-consumer trigger) — Sarah's, Maya's,
 * Marcus's, and Riley's own copies were verbatim-identical.
 */
export function confirmingQuestionLeadIn(
  fixture: ReplayFixture,
): string | undefined {
  return fixture.result.ok && 'questionLeadIn' in fixture.result
    ? fixture.result.questionLeadIn
    : undefined;
}
