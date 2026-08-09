import type { ReplayFixture } from './replay-fixture.js';
import type { ReplayScenario } from './replay-scenario.js';

import { hashReplayContent } from './hash-replay-content.js';

export type ReplayVerificationResult = {
  readonly ok: boolean;
  readonly failures: readonly string[];
};

export type VerifyReplayFixtureParams = {
  readonly scenario: ReplayScenario;
  readonly fixture: ReplayFixture | undefined;
  readonly currentPromptContent: string;
  readonly currentModel: string;
  readonly personaId: string;
};

// Shared across every failure message that asks for a re-recording — `docs/decisions/
// PERSONA-REPLAY-HARNESS.md`'s own Decision text claims every mismatch "fails the replay test
// with a message naming the re-record command"; this constant is what makes that literally true
// everywhere it applies, not just on the "fixture missing entirely" branch.
function recordCommandHint(personaId: string): string {
  return `run "pnpm --filter @moe/agents record:replay -- ${personaId}"`;
}

function staleness(params: {
  readonly scenario: ReplayScenario;
  readonly fixture: ReplayFixture;
  readonly currentPromptContent: string;
  readonly currentModel: string;
}): readonly string[] {
  const { scenario, fixture, currentPromptContent, currentModel } = params;
  const promptStale =
    fixture.promptContentHash !== hashReplayContent(currentPromptContent);
  const inputStale =
    fixture.scenarioInputHash !==
    hashReplayContent(JSON.stringify(scenario.input));
  const modelStale = fixture.model !== currentModel;
  const hint = recordCommandHint(fixture.personaId);

  return [
    ...(promptStale
      ? [
          `fixture is stale — prompt.md has changed since scenario "${scenario.id}" was recorded; ` +
            `${hint} and review the transcript diff`,
        ]
      : []),
    ...(inputStale
      ? [
          `fixture is stale — scenario "${scenario.id}"'s input has changed since it was ` +
            `recorded; ${hint}`,
        ]
      : []),
    ...(modelStale
      ? [
          `fixture is stale — resolved model for scenario "${scenario.id}" changed ` +
            `(recorded against "${fixture.model}", now "${currentModel}"); ${hint}`,
        ]
      : []),
  ];
}

function outcomeFailures(
  scenario: ReplayScenario,
  fixture: ReplayFixture,
): readonly string[] {
  const truncated = fixture.stopReason === 'max_tokens';
  const failed = !fixture.result.ok;
  const hint = recordCommandHint(fixture.personaId);

  return [
    ...(truncated
      ? [
          `recorded response for "${scenario.id}" was truncated (stop_reason=max_tokens) — ` +
            `raise max_tokens and ${hint}`,
        ]
      : []),
    ...(failed && !fixture.result.ok
      ? [
          `recorded call for "${scenario.id}" failed: ${fixture.result.error.kind} — ` +
            `${fixture.result.error.message}`,
        ]
      : []),
  ];
}

function assertionFailures(
  scenario: ReplayScenario,
  fixture: ReplayFixture,
): readonly string[] {
  return scenario.assertions
    .filter((assertion) => !assertion.check(fixture))
    .map(
      (assertion) =>
        `assertion failed for "${scenario.id}": ${assertion.description}`,
    );
}

/**
 * The persona-replay harness's CI-enforced gate (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
 * decisions 3/7) — every check here is equally blocking, with no advisory tier. Never calls the
 * network: `fixture` is whatever `persona-replay.test.ts` already loaded from a committed JSON
 * file, and `currentPromptContent`/`currentModel` are read straight from the persona's real
 * `prompt.md`/`resolvePersonaModel` at test time.
 */
export function verifyReplayFixture(
  params: VerifyReplayFixtureParams,
): ReplayVerificationResult {
  const { scenario, fixture, currentPromptContent, currentModel, personaId } =
    params;

  if (fixture === undefined) {
    return {
      ok: false,
      failures: [
        `no recorded fixture for scenario "${scenario.id}" — ` +
          `${recordCommandHint(personaId)}`,
      ],
    };
  }

  const failures = [
    ...staleness({ scenario, fixture, currentPromptContent, currentModel }),
    ...outcomeFailures(scenario, fixture),
    ...assertionFailures(scenario, fixture),
  ];

  return { ok: failures.length === 0, failures };
}
