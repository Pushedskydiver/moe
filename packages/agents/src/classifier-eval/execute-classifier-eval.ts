import type { LoadEvalSetsResult } from './eval-sets.js';
import type { EvalCreateClient } from './recording-eval-client.js';
import type { EvalCallRecord } from './run-eval.js';

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { evaluateCall, totalsByConfiguration } from './assess-eval.js';
import {
  EVAL_CONFIGURATIONS,
  RUNS_PER_MESSAGE,
} from './eval-configurations.js';
import { loadEvalSets } from './eval-sets.js';
import {
  formatCell,
  formatEvalResultsMarkdown,
} from './format-eval-results.js';
import { runClassifierEval } from './run-eval.js';
import {
  appendProgressRecord,
  resolveResultsBasename,
  saveEvalResults,
} from './save-eval-results.js';

export type ExecuteClassifierEvalResult =
  | {
      readonly ok: true;
      readonly jsonPath: string;
      readonly markdownPath: string;
    }
  | {
      readonly ok: false;
      readonly error: Extract<
        LoadEvalSetsResult,
        { readonly ok: false }
      >['error'];
    };

async function listExistingResults(
  resultsDir: string,
): Promise<readonly string[]> {
  try {
    return await readdir(resultsDir);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return [];
    throw error;
  }
}

/**
 * BUILD_PLAN 3.13's whole run, behind the manual `eval:classifiers` script: load the committed
 * sets (making no API call if any can't be loaded), run them, write the results JSON and table to
 * `resultsDir`. Each call's record is appended to `<basename>.partial.jsonl` there as it lands,
 * and that file is removed once the JSON and table are written, so a run cut short leaves it
 * behind. The only live part is whatever `client` is; the script alone passes a real one.
 */
export async function executeClassifierEval(options: {
  readonly client: EvalCreateClient;
  readonly setsDir: string;
  readonly resultsDir: string;
  readonly log: (line: string) => void;
}): Promise<ExecuteClassifierEvalResult> {
  const { client, setsDir, resultsDir, log } = options;
  const loaded = await loadEvalSets(setsDir);
  if (!loaded.ok) return loaded;

  const existing = await listExistingResults(resultsDir);
  const basename = resolveResultsBasename(new Date().toISOString(), existing);
  const results = await runClassifierEval({
    client,
    sets: loaded.sets,
    configurations: EVAL_CONFIGURATIONS,
    runsPerMessage: RUNS_PER_MESSAGE,
    onCall: async (record, position, total) => {
      await appendProgressRecord({ dir: resultsDir, basename, record });
      log(describeCall(loaded.sets, record, { position, total }));
    },
  });

  totalsByConfiguration(results).forEach((totals) =>
    log(
      `Configuration ${totals.configurationId}: matched ${totals.matched}/${totals.calls}, ` +
        `${totals.failed} failed, ${totals.cuts} cut, ${totals.refusals} refused, ` +
        `$${totals.costUsd.toFixed(4)}`,
    ),
  );

  await saveEvalResults({
    dir: resultsDir,
    basename,
    results,
    renderMarkdown: formatEvalResultsMarkdown,
  });

  return {
    ok: true,
    jsonPath: join(resultsDir, `${basename}.json`),
    markdownPath: join(resultsDir, `${basename}.md`),
  };
}

function describeCall(
  sets: Parameters<typeof evaluateCall>[0],
  record: EvalCallRecord,
  progress: { readonly position: number; readonly total: number },
): string {
  const cell = formatCell(record.outcome, evaluateCall(sets, record));

  return `[${progress.position}/${progress.total}] ${record.configurationId} ${record.setId}/${record.messageId} run ${record.run}: ${cell}`;
}
