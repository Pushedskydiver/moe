import { describe, expect, it } from 'vitest';

import {
  EVAL_CONFIGURATIONS,
  RUNS_PER_MESSAGE,
} from './eval-configurations.js';

describe('EVAL_CONFIGURATIONS', () => {
  it('lists A to D in order, matching the chunk 3.13 spec', () => {
    expect(EVAL_CONFIGURATIONS).toEqual([
      { id: 'A', model: 'claude-haiku-4-5', maxTokens: 256 },
      { id: 'B', model: 'claude-haiku-5-5', maxTokens: 256 },
      { id: 'C', model: 'claude-haiku-5-5', maxTokens: 256, effort: 'low' },
      { id: 'D', model: 'claude-haiku-5-5', maxTokens: 1024 },
    ]);
  });

  it('sets no effort key at all on A, B and D, not even an undefined one', () => {
    const withoutEffort = EVAL_CONFIGURATIONS.filter(
      (configuration) => configuration.id !== 'C',
    );

    expect(
      withoutEffort.map((configuration) => 'effort' in configuration),
    ).toEqual([false, false, false]);
  });

  it('runs each message three times per configuration', () => {
    expect(RUNS_PER_MESSAGE).toBe(3);
  });
});
