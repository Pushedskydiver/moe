import { describe, expect, it } from 'vitest';

import { parseReplayFixture } from './replay-fixture.js';

function validFixture() {
  return {
    scenarioId: 'evidence-before-verdict',
    personaId: 'sarah',
    callSite: 'dmReply',
    promptContentHash: 'a'.repeat(64),
    scenarioInputHash: 'b'.repeat(64),
    model: 'claude-sonnet-5',
    recordedAt: '2026-08-09T12:00:00.000Z',
    stopReason: 'end_turn',
    outputTokensRaw: 42,
    result: {
      ok: true,
      reply: 'not sure yet — let me check',
      toolUses: [],
      usage: { inputTokens: 10, outputTokens: 42 },
    },
  };
}

describe('parseReplayFixture', () => {
  it('accepts a well-formed dmReply fixture', () => {
    const result = parseReplayFixture(validFixture());
    expect(result.ok).toBe(true);
  });

  it('accepts a well-formed error-result fixture', () => {
    const fixture = {
      ...validFixture(),
      stopReason: null,
      result: {
        ok: false,
        error: { kind: 'anthropic-api-error', message: 'boom' },
      },
    };
    const result = parseReplayFixture(fixture);
    expect(result.ok).toBe(true);
  });

  it('rejects a fixture with a non-enum callSite', () => {
    const result = parseReplayFixture({
      ...validFixture(),
      callSite: 'somethingElse',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a fixture missing promptContentHash', () => {
    const rest: Record<string, unknown> = validFixture();
    delete rest.promptContentHash;
    const result = parseReplayFixture(rest);
    expect(result.ok).toBe(false);
  });

  it('rejects a fixture whose result has neither a true nor false ok literal', () => {
    const result = parseReplayFixture({
      ...validFixture(),
      result: { ok: 'yes', reply: 'x' },
    });
    expect(result.ok).toBe(false);
  });
});
