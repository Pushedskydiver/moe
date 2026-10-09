export type EvalModel = 'claude-haiku-4-5' | 'claude-haiku-5-5';

export type EvalConfigurationId = 'A' | 'B' | 'C' | 'D';

export type EvalConfiguration = {
  readonly id: EvalConfigurationId;
  readonly model: EvalModel;
  readonly maxTokens: number;
  // Absent (no key at all) on every configuration that doesn't set one: the wrapper sets it on
  // `output_config` only when present and drops the `effort` production's own call sends
  // (BUILD_PLAN 3.14), so A, B and D send none.
  readonly effort?: 'low';
};

/**
 * BUILD_PLAN 3.13's four configurations. A is Haiku 4.5 with no effort, production's call before
 * BUILD_PLAN 3.14; B is the same call on Haiku 5.5, whose adaptive thinking is on by default and
 * counts toward `max_tokens`, so B can stop before any text; C (a low effort) and D (a larger
 * budget) are the two ways out it measures. C is production's configuration since 3.14, the move
 * to Haiku 5.5, so a run of C measures the calls as they now ship.
 * There is no thinking-disabled configuration, though the API accepts `thinking: { type:
 * 'disabled' }` on Haiku 5.5 at effort `low`, `medium` or `high` (the `claude-api` skill's Haiku
 * 5.5 migration guide, which advises effort as the lever instead).
 */
export const EVAL_CONFIGURATIONS: readonly EvalConfiguration[] = [
  { id: 'A', model: 'claude-haiku-4-5', maxTokens: 256 },
  { id: 'B', model: 'claude-haiku-5-5', maxTokens: 256 },
  { id: 'C', model: 'claude-haiku-5-5', maxTokens: 256, effort: 'low' },
  { id: 'D', model: 'claude-haiku-5-5', maxTokens: 1024 },
];

/**
 * Each message runs this many times per configuration, for sampling variance — the 3.12
 * addendum's footnote saw 72 against 75 on one input.
 */
export const RUNS_PER_MESSAGE = 3;
