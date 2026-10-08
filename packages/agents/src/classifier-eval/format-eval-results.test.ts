import type { RawCapture } from './recording-eval-client.js';
import type {
  EvalCallOutcome,
  EvalCallRecord,
  EvalResults,
} from './run-eval.js';

import { describe, expect, it } from 'vitest';

import { EVAL_CONFIGURATIONS } from './eval-configurations.js';
import {
  formatCell,
  formatEvalResultsMarkdown,
} from './format-eval-results.js';

const capture = (overrides: Partial<RawCapture> = {}): RawCapture => ({
  stopReason: 'end_turn',
  contentBlockTypes: ['text'],
  usage: { inputTokens: 100, outputTokens: 20, thinkingTokens: null },
  ...overrides,
});

const classifierOk = (
  band: 'high' | 'mid' | 'low',
  confidence: number,
): EvalCallOutcome => ({
  ok: true,
  kind: 'classifier',
  confidence,
  band,
  reasoning: 'r',
});

function record(
  outcome: EvalCallOutcome,
  overrides: Partial<EvalCallRecord> = {},
): EvalCallRecord {
  return {
    configurationId: 'A',
    setId: 'classifier-set',
    messageId: 'work-1',
    run: 1,
    outcome,
    capture: capture(),
    ...overrides,
  };
}

const sets: EvalResults['sets'] = [
  {
    id: 'classifier-set',
    kind: 'classifier',
    description: 'A classifier set.',
    messages: [
      {
        id: 'work-1',
        label: 'work',
        text: 'fix the | build',
        expectedBands: ['high'],
      },
      {
        id: 'signal-1',
        label: 'signal',
        text: 'footer links',
        expectedBands: ['mid', 'high'],
      },
    ],
  },
  {
    id: 'gate-set',
    kind: 'gate',
    description: 'A gate set.',
    messages: [
      {
        id: 'g-1',
        label: 'death',
        text: 'a colleague died',
        expectedAppropriate: false,
      },
    ],
  },
];

describe('formatCell', () => {
  const noMatch = { matched: false, cut: false, refusal: false };
  const match = { matched: true, cut: false, refusal: false };

  it('shows a classifier result as its capitalised band and score, marking a mismatch with !', () => {
    expect(formatCell(classifierOk('high', 85), match)).toBe('High 85');
    expect(formatCell(classifierOk('low', 5), noMatch)).toBe('Low 5 !');
  });

  it('shows a gate result as the appropriate decision', () => {
    const gate = (appropriate: boolean): EvalCallOutcome => ({
      ok: true,
      kind: 'gate',
      appropriate,
      reasoning: 'r',
    });

    expect(formatCell(gate(false), match)).toBe('false');
    expect(formatCell(gate(true), noMatch)).toBe('true !');
  });

  it('shows a failure as ERR plus the production error kind', () => {
    const failed: EvalCallOutcome = {
      ok: false,
      errorKind: 'anthropic-api-error',
      errorMessage: 'x',
    };

    expect(formatCell(failed, noMatch)).toBe('ERR anthropic-api-error');
  });

  it('marks every cut and every refusal', () => {
    const failed: EvalCallOutcome = {
      ok: false,
      errorKind: 'no-parsed-output',
      errorMessage: 'x',
    };

    expect(
      formatCell(failed, { matched: false, cut: true, refusal: false }),
    ).toBe('ERR no-parsed-output CUT');
    expect(
      formatCell(failed, { matched: false, cut: false, refusal: true }),
    ).toBe('ERR no-parsed-output REFUSAL');
  });
});

describe('formatEvalResultsMarkdown', () => {
  const results: EvalResults = {
    startedAt: '2026-10-08T10:00:00.000Z',
    finishedAt: '2026-10-08T10:05:00.000Z',
    runsPerMessage: 2,
    configurations: EVAL_CONFIGURATIONS.slice(0, 2),
    sets,
    calls: [
      record(classifierOk('high', 85)),
      record(classifierOk('mid', 60), { run: 2 }),
      record(
        { ok: false, errorKind: 'no-parsed-output', errorMessage: 'x' },
        {
          configurationId: 'B',
          capture: capture({ stopReason: 'max_tokens' }),
        },
      ),
      record(classifierOk('high', 90), { configurationId: 'B', run: 2 }),
      record(classifierOk('mid', 50), { messageId: 'signal-1' }),
    ],
  };

  const markdown = formatEvalResultsMarkdown(results);

  it("lists each message with its expected label and each configuration's runs side by side", () => {
    expect(markdown).toContain('| work-1 |');
    expect(markdown).toContain('High 85 / Mid 60 !');
    expect(markdown).toContain('ERR no-parsed-output CUT / High 90');
  });

  it('writes a message that expects two bands as "Mid or High"', () => {
    expect(markdown).toContain('Mid or High');
  });

  it('escapes a pipe in a message so it cannot split a table cell', () => {
    expect(markdown).toContain('fix the \\| build');
  });

  it('gives each configuration its model, max_tokens and effort in the header', () => {
    expect(markdown).toContain('claude-haiku-4-5');
    expect(markdown).toContain('claude-haiku-5-5');
    expect(markdown).toMatch(/\| A \| claude-haiku-4-5 \| 256 \| none \|/);
  });

  it('totals tokens, cost and matches per configuration', () => {
    expect(markdown).toMatch(/\| A \|[^\n]*\| 3 \| 2 \|/);
    expect(markdown).toContain('Cost (USD)');
    expect(markdown).toContain('Thinking tokens');
  });

  it('names the run window and explains the marks', () => {
    expect(markdown).toContain('2026-10-08T10:00:00.000Z');
    expect(markdown).toContain('CUT');
    expect(markdown).toContain('REFUSAL');
  });

  it('says a message with no recorded call in a configuration has none, rather than inventing a cell', () => {
    expect(markdown).toContain('no call');
  });
});
