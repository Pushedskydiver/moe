import type { ReplayFixture } from './replay-fixture.js';
import type { ReplayScenario } from './replay-scenario.js';

import { describe, expect, it } from 'vitest';

import { hashReplayContent } from './hash-replay-content.js';
import { verifyReplayFixture } from './verify-replay-fixture.js';

const PROMPT_CONTENT = "You're Sarah, moe's PM.";
const MODEL = 'claude-sonnet-5';

function scenario(overrides: Partial<ReplayScenario> = {}): ReplayScenario {
  return {
    id: 'evidence-before-verdict',
    callSite: 'dmReply',
    description: 'declines to confirm an unverified claim',
    input: { text: 'is the migration definitely safe?' },
    assertions: [],
    ...overrides,
  };
}

function fixture(overrides: Partial<ReplayFixture> = {}): ReplayFixture {
  return {
    scenarioId: 'evidence-before-verdict',
    personaId: 'sarah',
    callSite: 'dmReply',
    promptContentHash: hashReplayContent(PROMPT_CONTENT),
    scenarioInputHash: hashReplayContent(JSON.stringify(scenario().input)),
    model: MODEL,
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'end_turn',
    outputTokensRaw: 42,
    result: {
      ok: true,
      reply: 'not sure yet — let me check before I say anything definitive',
      toolUses: [],
      usage: { inputTokens: 10, outputTokens: 42 },
    },
    ...overrides,
  };
}

describe('verifyReplayFixture', () => {
  it('passes a well-formed, up-to-date, successful fixture with no assertions', () => {
    const result = verifyReplayFixture({
      scenario: scenario(),
      fixture: fixture(),
      currentPromptContent: PROMPT_CONTENT,
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result).toEqual({ ok: true, failures: [] });
  });

  it('fails when no fixture was recorded for the scenario', () => {
    const result = verifyReplayFixture({
      scenario: scenario(),
      fixture: undefined,
      currentPromptContent: PROMPT_CONTENT,
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain('no recorded fixture');
    expect(result.failures[0]).toContain('evidence-before-verdict');
  });

  it('fails when prompt.md has changed since recording (stale promptContentHash)', () => {
    const result = verifyReplayFixture({
      scenario: scenario(),
      fixture: fixture(),
      currentPromptContent: 'a completely different prompt now',
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('prompt.md'))).toBe(true);
  });

  it('fails when the scenario input has changed since recording (stale scenarioInputHash)', () => {
    const changedScenario = scenario({
      input: { text: 'a totally different message' },
    });
    const result = verifyReplayFixture({
      scenario: changedScenario,
      fixture: fixture(),
      currentPromptContent: PROMPT_CONTENT,
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('input'))).toBe(true);
  });

  it('fails when the resolved model has changed since recording', () => {
    const result = verifyReplayFixture({
      scenario: scenario(),
      fixture: fixture(),
      currentPromptContent: PROMPT_CONTENT,
      currentModel: 'claude-opus-5',
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('model'))).toBe(true);
  });

  it('fails when the recorded call was truncated (stop_reason max_tokens)', () => {
    const result = verifyReplayFixture({
      scenario: scenario(),
      fixture: fixture({ stopReason: 'max_tokens' }),
      currentPromptContent: PROMPT_CONTENT,
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('truncated'))).toBe(true);
  });

  it('fails when the recorded call itself failed (result.ok === false)', () => {
    const result = verifyReplayFixture({
      scenario: scenario(),
      fixture: fixture({
        result: {
          ok: false,
          error: { kind: 'anthropic-api-error', message: 'rate limited' },
        },
      }),
      currentPromptContent: PROMPT_CONTENT,
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('rate limited'))).toBe(true);
  });

  it('fails when a scenario assertion rejects the recorded output', () => {
    const withAssertion = scenario({
      assertions: [
        {
          description: 'reply mentions the word "verify"',
          check: (f) =>
            f.result.ok &&
            'reply' in f.result &&
            f.result.reply.includes('verify'),
        },
      ],
    });
    const result = verifyReplayFixture({
      scenario: withAssertion,
      fixture: fixture(),
      currentPromptContent: PROMPT_CONTENT,
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(
      result.failures.some((f) =>
        f.includes('reply mentions the word "verify"'),
      ),
    ).toBe(true);
  });

  it('passes when every scenario assertion accepts the recorded output', () => {
    const withAssertion = scenario({
      assertions: [
        {
          description: 'reply does not confirm the claim outright',
          check: (f) =>
            f.result.ok &&
            'reply' in f.result &&
            f.result.reply.includes('not sure'),
        },
      ],
    });
    const result = verifyReplayFixture({
      scenario: withAssertion,
      fixture: fixture(),
      currentPromptContent: PROMPT_CONTENT,
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result).toEqual({ ok: true, failures: [] });
  });

  it('reports every applicable failure at once, not just the first', () => {
    const result = verifyReplayFixture({
      scenario: scenario(),
      fixture: fixture({ stopReason: 'max_tokens', model: 'claude-opus-5' }),
      currentPromptContent: 'a different prompt',
      currentModel: MODEL,
      personaId: 'sarah',
    });
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
  });
});
