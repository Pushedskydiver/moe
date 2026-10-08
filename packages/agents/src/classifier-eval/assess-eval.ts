import type { EvalConfiguration } from './eval-configurations.js';
import type { EvalSet } from './eval-sets.js';
import type { EvalCallRecord, EvalResults } from './run-eval.js';

import { evalCostUsdMicros } from './eval-pricing.js';

export type CallAssessment = {
  // A failed call is never a match.
  readonly matched: boolean;
  // stop_reason `max_tokens`, or a response with no parsed output at all.
  readonly cut: boolean;
  // stop_reason `refusal`.
  readonly refusal: boolean;
};

function findMessage(sets: readonly EvalSet[], record: EvalCallRecord) {
  const set = sets.find((candidate) => candidate.id === record.setId);
  const message = set?.messages.find(
    (candidate) => candidate.id === record.messageId,
  );
  if (message === undefined) {
    throw new Error(
      `no message ${record.setId}/${record.messageId} in the results' sets`,
    );
  }
  return message;
}

function isExpected(
  message: ReturnType<typeof findMessage>,
  outcome: EvalCallRecord['outcome'],
): boolean {
  if (!outcome.ok) return false;
  if (outcome.kind === 'classifier') {
    return (
      'expectedBands' in message && message.expectedBands.includes(outcome.band)
    );
  }
  return (
    'expectedAppropriate' in message &&
    message.expectedAppropriate === outcome.appropriate
  );
}

export function assessCall(
  sets: readonly EvalSet[],
  record: EvalCallRecord,
): CallAssessment {
  const noParsedOutput =
    !record.outcome.ok && record.outcome.errorKind === 'no-parsed-output';

  return {
    matched: isExpected(findMessage(sets, record), record.outcome),
    cut: record.capture?.stopReason === 'max_tokens' || noParsedOutput,
    refusal: record.capture?.stopReason === 'refusal',
  };
}

export type ConfigurationTotals = {
  readonly configurationId: EvalConfiguration['id'];
  readonly calls: number;
  readonly matched: number;
  readonly failed: number;
  readonly cuts: number;
  readonly refusals: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  // Already inside `outputTokens`; only the calls whose response carried a breakdown count.
  readonly thinkingTokens: number;
  readonly costUsd: number;
};

// No `reduce()` (docs/CONVENTIONS.md §Code Style), and a few hundred numbers at most.
function sum(values: readonly number[]): number {
  const [head, ...rest] = values;
  return head === undefined ? 0 : head + sum(rest);
}

function totalsFor(
  results: EvalResults,
  configuration: EvalConfiguration,
): ConfigurationTotals {
  const records = results.calls.filter(
    (call) => call.configurationId === configuration.id,
  );
  const assessments = records.map((record) => assessCall(results.sets, record));
  const usages = records.flatMap((record) =>
    record.capture === null ? [] : [record.capture.usage],
  );

  return {
    configurationId: configuration.id,
    calls: records.length,
    matched: assessments.filter((assessment) => assessment.matched).length,
    failed: records.filter((record) => !record.outcome.ok).length,
    cuts: assessments.filter((assessment) => assessment.cut).length,
    refusals: assessments.filter((assessment) => assessment.refusal).length,
    inputTokens: sum(usages.map((usage) => usage.inputTokens)),
    outputTokens: sum(usages.map((usage) => usage.outputTokens)),
    thinkingTokens: sum(usages.map((usage) => usage.thinkingTokens ?? 0)),
    // A call that failed after the API answered (a cut, a refusal) still billed its tokens.
    costUsd:
      sum(
        usages.map((usage) => evalCostUsdMicros(configuration.model, usage)),
      ) / 1_000_000,
  };
}

/** One row per configuration, in the configurations' own order. */
export function totalsByConfiguration(
  results: EvalResults,
): readonly ConfigurationTotals[] {
  return results.configurations.map((configuration) =>
    totalsFor(results, configuration),
  );
}
