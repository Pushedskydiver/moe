import type { EvalCallRecord, EvalResults } from './run-eval.js';

import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASENAME_PREFIX = 'classifier-eval-';

function firstFreeBasename(
  base: string,
  existingFiles: readonly string[],
  attempt: number,
): string {
  const candidate = attempt === 1 ? base : `${base}-${attempt}`;
  const isTaken = existingFiles.some((file) =>
    file.startsWith(`${candidate}.`),
  );

  return isTaken
    ? firstFreeBasename(base, existingFiles, attempt + 1)
    : candidate;
}

/**
 * `classifier-eval-<date>`, or `-2`, `-3`, … when files for that date are already in the results
 * directory: a second run on the same day must not overwrite the first, which cost real money.
 * `startedAt` is an ISO timestamp; its date part is the UTC day.
 */
export function resolveResultsBasename(
  startedAt: string,
  existingFiles: readonly string[],
): string {
  return firstFreeBasename(
    `${BASENAME_PREFIX}${startedAt.slice(0, 10)}`,
    existingFiles,
    1,
  );
}

/** The file a run appends each call to as it goes; present after a run only if it was cut short. */
export function progressFileName(basename: string): string {
  return `${basename}.partial.jsonl`;
}

/**
 * Appends one call's record to the run's progress file as one JSON line, creating the directory
 * and the file on first use. A run killed part-way (Ctrl-C, a closed terminal) leaves every
 * finished call here, usage included.
 */
export async function appendProgressRecord(options: {
  readonly dir: string;
  readonly basename: string;
  readonly record: EvalCallRecord;
}): Promise<void> {
  const { dir, basename, record } = options;
  await mkdir(dir, { recursive: true });
  await appendFile(
    join(dir, progressFileName(basename)),
    `${JSON.stringify(record)}\n`,
    'utf8',
  );
}

/**
 * Writes the results JSON, then builds and writes the markdown table, each with the `wx` flag so
 * an existing file is an error, never an overwrite, and last removes the run's progress file. The
 * JSON goes first and the table is built only after it, so a failure while formatting still
 * leaves the full results on disk; a failed run keeps its progress file. Called only by the
 * manual `eval:classifiers` script.
 */
export async function saveEvalResults(options: {
  readonly dir: string;
  readonly basename: string;
  readonly results: EvalResults;
  readonly renderMarkdown: (results: EvalResults) => string;
}): Promise<void> {
  const { dir, basename, results, renderMarkdown } = options;
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${basename}.json`),
    `${JSON.stringify(results, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  await writeFile(join(dir, `${basename}.md`), renderMarkdown(results), {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rm(join(dir, progressFileName(basename)), { force: true });
}
