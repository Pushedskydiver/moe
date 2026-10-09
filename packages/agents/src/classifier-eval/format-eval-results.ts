import type { CallAssessment } from './assess-eval.js';
import type { EvalConfiguration } from './eval-configurations.js';
import type { EvalSet } from './eval-sets.js';
import type {
  EvalCallOutcome,
  EvalCallRecord,
  EvalResults,
} from './run-eval.js';

import { evaluateCall, totalsByConfiguration } from './assess-eval.js';

function capitalise(word: string): string {
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
}

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * One call's cell: the band and score for the classifier, the decision for the gate, `ERR` and
 * the production function's error kind for a failure; `!` after a result that isn't one the set
 * expected, and `CUT` or `REFUSAL` after any call the wrapper saw cut or refused.
 */
export function formatCell(
  outcome: EvalCallOutcome,
  assessment: CallAssessment,
): string {
  const result = outcome.ok
    ? formatResult(outcome, assessment.matched)
    : `ERR ${outcome.errorKind}`;
  const marks = [
    assessment.cut ? 'CUT' : null,
    assessment.refusal ? 'REFUSAL' : null,
  ];

  return [result, ...marks].filter((part) => part !== null).join(' ');
}

function formatResult(
  outcome: Extract<EvalCallOutcome, { readonly ok: true }>,
  matched: boolean,
): string {
  const value =
    outcome.kind === 'classifier'
      ? `${capitalise(outcome.band)} ${outcome.confidence}`
      : String(outcome.appropriate);

  return matched ? value : `${value} !`;
}

function expectedLabel(message: EvalSet['messages'][number]): string {
  return 'expectedBands' in message
    ? message.expectedBands.map((band) => capitalise(band)).join(' or ')
    : `appropriate ${String(message.expectedAppropriate)}`;
}

function cellsFor(
  results: EvalResults,
  set: EvalSet,
  cell: {
    readonly messageId: string;
    readonly configuration: EvalConfiguration;
  },
): string {
  const { messageId, configuration } = cell;
  const records = results.calls
    .filter(
      (call) =>
        call.setId === set.id &&
        call.messageId === messageId &&
        call.configurationId === configuration.id,
    )
    .toSorted((first, second) => first.run - second.run);
  if (records.length === 0) return 'no call';

  return records
    .map((record) =>
      formatCell(record.outcome, evaluateCall(results.sets, record)),
    )
    .join(' / ');
}

function tableRow(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function tableOf(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): readonly string[] {
  return [
    tableRow(header),
    tableRow(header.map(() => '---')),
    ...rows.map((row) => tableRow(row)),
  ];
}

function configurationSection(results: EvalResults): readonly string[] {
  const rows = totalsByConfiguration(results).map((totals) => {
    const configuration = results.configurations.find(
      (candidate) => candidate.id === totals.configurationId,
    );
    return [
      totals.configurationId,
      configuration?.model ?? '',
      String(configuration?.maxTokens ?? ''),
      configuration?.effort ?? 'none',
      String(totals.calls),
      String(totals.matched),
      String(totals.failed),
      String(totals.cuts),
      String(totals.refusals),
      String(totals.inputTokens),
      String(totals.outputTokens),
      String(totals.thinkingTokens),
      totals.costUsd.toFixed(4),
    ];
  });

  return [
    '## Configurations and totals',
    '',
    ...tableOf(
      [
        'Configuration',
        'Model',
        'max_tokens',
        'Effort',
        'Calls',
        'Matched',
        'Failed',
        'Cut',
        'Refused',
        'Input tokens',
        'Output tokens',
        'Thinking tokens',
        'Cost (USD)',
      ],
      rows,
    ),
    '',
    'A failed call is never a match. Tokens and cost include the calls that failed after the API answered (a cut, a refusal). Thinking tokens are already inside output tokens, and count only the responses that report them, so a configuration whose responses report none shows 0 without having measured it.',
  ];
}

function matchesBySetSection(results: EvalResults): readonly string[] {
  const rows = results.configurations.map((configuration) => [
    configuration.id,
    ...results.sets.map((set) => {
      const records: readonly EvalCallRecord[] = results.calls.filter(
        (call) =>
          call.setId === set.id && call.configurationId === configuration.id,
      );
      const matched = records.filter(
        (record) => evaluateCall(results.sets, record).matched,
      ).length;
      return `${matched}/${records.length}`;
    }),
  ]);

  return [
    '## Matches by set',
    '',
    ...tableOf(['Configuration', ...results.sets.map((set) => set.id)], rows),
  ];
}

function setSection(results: EvalResults, set: EvalSet): readonly string[] {
  const rows = set.messages.map((message) => [
    message.id,
    escapeCell(message.text),
    escapeCell(`${message.label}: ${expectedLabel(message)}`),
    ...results.configurations.map((configuration) =>
      cellsFor(results, set, { messageId: message.id, configuration }),
    ),
  ]);

  return [
    `## ${set.id}`,
    '',
    set.description,
    '',
    ...tableOf(
      [
        'Message',
        'Text',
        'Expected',
        ...results.configurations.map((configuration) => configuration.id),
      ],
      rows,
    ),
  ];
}

/**
 * BUILD_PLAN 3.13's results table: each message's result per configuration and run beside its
 * expected label, with every cut, refusal and error kind marked, and per-configuration totals of
 * tokens and cost. Runs of one message in one configuration are joined with ` / `, in run order.
 */
export function formatEvalResultsMarkdown(results: EvalResults): string {
  const lines = [
    `# Classifier eval, ${results.startedAt}`,
    '',
    `Run from ${results.startedAt} to ${results.finishedAt}: ${results.calls.length} calls, ${results.runsPerMessage} runs per message per configuration, one call at a time. Generated by \`pnpm --filter @moe/agents eval:classifiers\`; not edited by hand.`,
    '',
    "Each cell is one configuration, its runs in order, joined by `/`. A classifier cell is the band and score; a gate cell is `appropriate`. `!` marks a result that is not one the set expected. `ERR <kind>` is a failed call, `<kind>` being the production function's own error kind. `CUT` marks a response with stop_reason `max_tokens`, or with no parsed output and a stop_reason other than `refusal`; `REFUSAL` marks stop_reason `refusal`.",
    '',
    ...configurationSection(results),
    '',
    ...matchesBySetSection(results),
    ...results.sets.flatMap((set) => ['', ...setSection(results, set)]),
  ];

  return `${lines.join('\n')}\n`;
}
