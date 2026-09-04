import type { ReplayFixture } from './replay-fixture.js';

/**
 * BUILD_PLAN 6.1c's own scenario-assertion accessor — mirrors `brief-summary.ts`'s identical "pull
 * the one field this callSite's assertions care about off a fixture's `result`" shape. Only
 * `approach` has an accessor here — no accessor for `confidence`/`alternativesConsidered`/
 * `openQuestions` unless a future scenario actually needs one, same restraint `brief-summary.ts`'s
 * own single-accessor precedent shows.
 */
export function planApproach(fixture: ReplayFixture): string | undefined {
  return fixture.result.ok && 'approach' in fixture.result
    ? fixture.result.approach
    : undefined;
}
