import type { EvalResults } from './run-eval.js';

import { mkdir, writeFile } from 'node:fs/promises';
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
export function pickResultsBasename(
  startedAt: string,
  existingFiles: readonly string[],
): string {
  return firstFreeBasename(
    `${BASENAME_PREFIX}${startedAt.slice(0, 10)}`,
    existingFiles,
    1,
  );
}

/**
 * Writes the results JSON and the markdown table, each with the `wx` flag so an existing file is
 * an error, never an overwrite. Called only by the manual `eval:classifiers` script.
 */
export async function saveEvalResults(options: {
  readonly dir: string;
  readonly basename: string;
  readonly results: EvalResults;
  readonly markdown: string;
}): Promise<void> {
  const { dir, basename, results, markdown } = options;
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${basename}.json`),
    `${JSON.stringify(results, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  await writeFile(join(dir, `${basename}.md`), markdown, {
    encoding: 'utf8',
    flag: 'wx',
  });
}
