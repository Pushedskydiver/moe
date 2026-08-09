import type { ReplayFixture } from './replay-fixture.js';

type ReplayCallSite = 'dmReply' | 'ticketDraft' | 'confirmingQuestion';

type ReplayScenarioInput = {
  readonly text: string;
  readonly history?: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>;
  readonly confidence?: number;
  readonly reasoning?: string;
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
