import type { ReplayFixture } from './replay-fixture.js';

/**
 * BUILD_PLAN 6.1b's own scenario-assertion accessor — mirrors `ticket-draft-body.ts`'s identical
 * "pull the one field this callSite's assertions care about off a fixture's `result`" shape.
 */
export function briefSummary(fixture: ReplayFixture): string | undefined {
  return fixture.result.ok && 'summary' in fixture.result
    ? fixture.result.summary
    : undefined;
}
