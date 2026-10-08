import type { EvalResults } from './run-eval.js';

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pickResultsBasename, saveEvalResults } from './save-eval-results.js';

describe('pickResultsBasename', () => {
  it('names a run by its date', () => {
    expect(pickResultsBasename('2026-10-08T10:00:00.000Z', [])).toBe(
      'classifier-eval-2026-10-08',
    );
  });

  it('never overwrites an earlier run on the same date: it counts up from 2', () => {
    const first = [
      'classifier-eval-2026-10-08.json',
      'classifier-eval-2026-10-08.md',
    ];

    expect(pickResultsBasename('2026-10-08T18:00:00.000Z', first)).toBe(
      'classifier-eval-2026-10-08-2',
    );
    expect(
      pickResultsBasename('2026-10-08T19:00:00.000Z', [
        ...first,
        'classifier-eval-2026-10-08-2.json',
      ]),
    ).toBe('classifier-eval-2026-10-08-3');
  });

  it("is not confused by another date's files", () => {
    expect(
      pickResultsBasename('2026-10-08T10:00:00.000Z', [
        'classifier-eval-2026-10-07.json',
        'README.md',
      ]),
    ).toBe('classifier-eval-2026-10-08');
  });
});

describe('saveEvalResults', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'moe-save-eval-results-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const results: EvalResults = {
    startedAt: '2026-10-08T10:00:00.000Z',
    finishedAt: '2026-10-08T10:01:00.000Z',
    runsPerMessage: 3,
    configurations: [],
    sets: [],
    calls: [],
  };

  it('writes the results JSON and the markdown table side by side, creating the directory', async () => {
    const target = join(dir, 'results');

    await saveEvalResults({
      dir: target,
      basename: 'classifier-eval-2026-10-08',
      results,
      markdown: '# table\n',
    });

    expect(
      JSON.parse(
        readFileSync(join(target, 'classifier-eval-2026-10-08.json'), 'utf8'),
      ),
    ).toEqual(results);
    expect(
      readFileSync(join(target, 'classifier-eval-2026-10-08.md'), 'utf8'),
    ).toBe('# table\n');
  });

  it('refuses to overwrite an existing file', async () => {
    const options = {
      dir,
      basename: 'classifier-eval-2026-10-08',
      results,
      markdown: '# table\n',
    };
    await saveEvalResults(options);

    await expect(saveEvalResults(options)).rejects.toThrow();
    expect(existsSync(join(dir, 'classifier-eval-2026-10-08.json'))).toBe(true);
  });
});
