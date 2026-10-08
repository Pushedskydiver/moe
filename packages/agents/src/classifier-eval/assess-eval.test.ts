import type { RawCapture } from './recording-eval-client.js';
import type {
  EvalCallOutcome,
  EvalCallRecord,
  EvalResults,
} from './run-eval.js';

import { describe, expect, it } from 'vitest';

import { assessCall, totalsByConfiguration } from './assess-eval.js';
import { EVAL_CONFIGURATIONS } from './eval-configurations.js';

const capture = (
  overrides: Partial<RawCapture> = {},
  usage: Partial<RawCapture['usage']> = {},
): RawCapture => ({
  stopReason: 'end_turn',
  contentBlockTypes: ['text'],
  usage: { inputTokens: 100, outputTokens: 20, thinkingTokens: null, ...usage },
  ...overrides,
});

function record(
  messageId: string,
  outcome: EvalCallOutcome,
  overrides: Partial<EvalCallRecord> = {},
): EvalCallRecord {
  return {
    configurationId: 'A',
    setId: 'classifier-set',
    messageId,
    run: 1,
    outcome,
    capture: capture(),
    ...overrides,
  };
}

const classifierOk = (band: 'high' | 'mid' | 'low'): EvalCallOutcome => ({
  ok: true,
  kind: 'classifier',
  confidence: 50,
  band,
  reasoning: 'r',
});

const results: EvalResults = {
  startedAt: '2026-10-08T10:00:00.000Z',
  finishedAt: '2026-10-08T10:05:00.000Z',
  runsPerMessage: 1,
  configurations: EVAL_CONFIGURATIONS.slice(0, 2),
  sets: [
    {
      id: 'classifier-set',
      kind: 'classifier',
      description: 'd',
      messages: [
        { id: 'work', label: 'work', text: 't', expectedBands: ['high'] },
        {
          id: 'signal',
          label: 'signal',
          text: 't',
          expectedBands: ['mid', 'high'],
        },
      ],
    },
    {
      id: 'gate-set',
      kind: 'gate',
      description: 'd',
      messages: [
        { id: 'g', label: 'death', text: 't', expectedAppropriate: false },
      ],
    },
  ],
  calls: [],
};

describe('assessCall', () => {
  it('matches a classifier band that is any of the expected bands', () => {
    expect(
      assessCall(results.sets, record('signal', classifierOk('mid'))).matched,
    ).toBe(true);
    expect(
      assessCall(results.sets, record('signal', classifierOk('high'))).matched,
    ).toBe(true);
    expect(
      assessCall(results.sets, record('signal', classifierOk('low'))).matched,
    ).toBe(false);
  });

  it("matches a gate decision against the message's expectedAppropriate", () => {
    const gateOk = (appropriate: boolean): EvalCallOutcome => ({
      ok: true,
      kind: 'gate',
      appropriate,
      reasoning: 'r',
    });

    expect(
      assessCall(
        results.sets,
        record('g', gateOk(false), { setId: 'gate-set' }),
      ).matched,
    ).toBe(true);
    expect(
      assessCall(results.sets, record('g', gateOk(true), { setId: 'gate-set' }))
        .matched,
    ).toBe(false);
  });

  it('counts a failed call as not matched', () => {
    const failed: EvalCallOutcome = {
      ok: false,
      errorKind: 'anthropic-api-error',
      errorMessage: 'x',
    };

    expect(
      assessCall(results.sets, record('work', failed, { capture: null }))
        .matched,
    ).toBe(false);
  });

  it('flags a cut for a max_tokens stop_reason, and for a response with no parsed output', () => {
    const noOutput: EvalCallOutcome = {
      ok: false,
      errorKind: 'no-parsed-output',
      errorMessage: 'x',
    };

    expect(
      assessCall(
        results.sets,
        record('work', noOutput, {
          capture: capture({ stopReason: 'max_tokens' }),
        }),
      ).cut,
    ).toBe(true);
    expect(
      assessCall(
        results.sets,
        record('work', noOutput, {
          capture: capture({ stopReason: 'end_turn' }),
        }),
      ).cut,
    ).toBe(true);
    expect(
      assessCall(results.sets, record('work', classifierOk('high'))).cut,
    ).toBe(false);
  });

  it('flags a refusal by stop_reason, not by error kind', () => {
    const invalid: EvalCallOutcome = {
      ok: false,
      errorKind: 'invalid-classification-output',
      errorMessage: 'x',
    };

    expect(
      assessCall(
        results.sets,
        record('work', invalid, {
          capture: capture({ stopReason: 'refusal' }),
        }),
      ).refusal,
    ).toBe(true);
    expect(
      assessCall(
        results.sets,
        record('work', invalid, {
          capture: capture({ stopReason: 'end_turn' }),
        }),
      ).refusal,
    ).toBe(false);
  });
});

describe('totalsByConfiguration', () => {
  const withCalls: EvalResults = {
    ...results,
    calls: [
      record('work', classifierOk('high'), {
        capture: capture({}, { inputTokens: 1_000_000, outputTokens: 0 }),
      }),
      record('work', classifierOk('low'), {
        configurationId: 'B',
        capture: capture(
          {},
          { inputTokens: 0, outputTokens: 1_000_000, thinkingTokens: 400 },
        ),
      }),
      record(
        'signal',
        { ok: false, errorKind: 'no-parsed-output', errorMessage: 'x' },
        {
          configurationId: 'B',
          capture: capture(
            { stopReason: 'max_tokens' },
            { inputTokens: 0, outputTokens: 1_000_000, thinkingTokens: 600 },
          ),
        },
      ),
      record(
        'work',
        { ok: false, errorKind: 'anthropic-api-error', errorMessage: 'x' },
        { configurationId: 'B', capture: null },
      ),
    ],
  };

  it('totals calls, matches, failures, cuts, refusals and tokens per configuration', () => {
    const [a, b] = totalsByConfiguration(withCalls);

    expect(a).toMatchObject({
      configurationId: 'A',
      calls: 1,
      matched: 1,
      failed: 0,
      cuts: 0,
      refusals: 0,
      inputTokens: 1_000_000,
    });
    expect(b).toMatchObject({
      configurationId: 'B',
      calls: 3,
      matched: 0,
      failed: 2,
      cuts: 1,
      refusals: 0,
      outputTokens: 2_000_000,
      thinkingTokens: 1000,
    });
  });

  it("prices each configuration at its own model's rate, counting a failed call's tokens too", () => {
    const [a, b] = totalsByConfiguration(withCalls);

    // A: Haiku 4.5, 1M input at $1/MTok. B: Haiku 5.5, 2M output at $0.50/MTok.
    expect(a?.costUsd).toBeCloseTo(1, 9);
    expect(b?.costUsd).toBeCloseTo(1, 9);
  });
});
