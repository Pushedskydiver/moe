import type { ReplayFixture } from './replay-fixture.js';

type ReplayCallSite =
  'dmReply' | 'ticketDraft' | 'confirmingQuestion' | 'brief' | 'plan';

type ReplayScenarioInput = {
  readonly text: string;
  readonly history?: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>;
  readonly confidence?: number;
  readonly reasoning?: string;
  // BUILD_PLAN 6.1c — a `'plan'`-callSite scenario's already-composed Brief content (`text`
  // doubles as the ticket's own `title`, same "one field genuinely double-duties" precedent
  // `composeBrief`'s own `body`-less scenarios already established for `text`). Same
  // lightweight-optional-widening precedent Brief's own `body`-less "widen if a future scenario
  // needs it" comment set — widen further if a future scenario needs something these two fields
  // don't cover.
  readonly briefSummary?: string;
  readonly briefScope?: readonly string[];
};

type ReplayAssertion = {
  readonly description: string;
  readonly check: (fixture: ReplayFixture) => boolean;
};

/**
 * A persona-replay scenario (`docs/decisions/PERSONA-REPLAY-HARNESS.md` decision 6) — pure data
 * plus pure assertion predicates, defined per persona at
 * `packages/agents/src/personas/<id>/replay/scenarios.ts`. `record-persona-replay.ts` runs
 * `input` through the real cascade function named by `callSite` against the real API and writes
 * the result as a fixture; `persona-replay.test.ts` loads that fixture and runs it back through
 * `verifyReplayFixture` with `assertions`, entirely offline.
 */
export type ReplayScenario = {
  readonly id: string;
  readonly callSite: ReplayCallSite;
  readonly description: string;
  readonly input: ReplayScenarioInput;
  readonly assertions: readonly ReplayAssertion[];
};
