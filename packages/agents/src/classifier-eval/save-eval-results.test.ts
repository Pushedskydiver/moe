import type { EvalCallRecord, EvalResults } from './run-eval.js';

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  appendProgressRecord,
  progressFileName,
  resolveResultsBasename,
  saveEvalResults,
} from './save-eval-results.js';

const record: EvalCallRecord = {
  configurationId: 'A',
  setId: 'classifier-set',
  messageId: 'c1',
  run: 1,
  outcome: { ok: false, errorKind: 'anthropic-api-error', errorMessage: 'x' },
  capture: null,
};

describe('resolveResultsBasename', () => {
  it('names a run by its date', () => {
    expect(resolveResultsBasename('2026-10-08T10:00:00.000Z', [])).toBe(
      'classifier-eval-2026-10-08',
    );
  });

  it('never overwrites an earlier run on the same date: it counts up from 2', () => {
    const first = [
      'classifier-eval-2026-10-08.json',
      'classifier-eval-2026-10-08.md',
    ];

    expect(resolveResultsBasename('2026-10-08T18:00:00.000Z', first)).toBe(
      'classifier-eval-2026-10-08-2',
    );
    expect(
      resolveResultsBasename('2026-10-08T19:00:00.000Z', [
        ...first,
        'classifier-eval-2026-10-08-2.json',
      ]),
    ).toBe('classifier-eval-2026-10-08-3');
  });

  it("treats an interrupted run's progress file as taking its name", () => {
    expect(
      resolveResultsBasename('2026-10-08T18:00:00.000Z', [
        'classifier-eval-2026-10-08.partial.jsonl',
      ]),
    ).toBe('classifier-eval-2026-10-08-2');
  });

  it("is not confused by another date's files", () => {
    expect(
      resolveResultsBasename('2026-10-08T10:00:00.000Z', [
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
      renderMarkdown: () => '# table\n',
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
      renderMarkdown: () => '# table\n',
    };
    await saveEvalResults(options);

    await expect(saveEvalResults(options)).rejects.toThrow();
    expect(existsSync(join(dir, 'classifier-eval-2026-10-08.json'))).toBe(true);
  });

  it('writes the JSON before it builds the table, so a failure while formatting keeps the results', async () => {
    await appendProgressRecord({
      dir,
      basename: 'classifier-eval-2026-10-08',
      record,
    });

    await expect(
      saveEvalResults({
        dir,
        basename: 'classifier-eval-2026-10-08',
        results,
        renderMarkdown: () => {
          throw new Error('cannot format');
        },
      }),
    ).rejects.toThrow('cannot format');

    expect(readdirSync(dir).sort()).toEqual([
      'classifier-eval-2026-10-08.json',
      'classifier-eval-2026-10-08.partial.jsonl',
    ]);
  });

  it('removes the progress file once the JSON and table are written', async () => {
    await appendProgressRecord({
      dir,
      basename: 'classifier-eval-2026-10-08',
      record,
    });

    await saveEvalResults({
      dir,
      basename: 'classifier-eval-2026-10-08',
      results,
      renderMarkdown: () => '# table\n',
    });

    expect(readdirSync(dir).sort()).toEqual([
      'classifier-eval-2026-10-08.json',
      'classifier-eval-2026-10-08.md',
    ]);
  });
});

describe('appendProgressRecord', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'moe-progress-record-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends each record as one JSON line to the run's progress file, creating the directory", async () => {
    const target = join(dir, 'results');
    const second: EvalCallRecord = { ...record, run: 2 };

    await appendProgressRecord({ dir: target, basename: 'run', record });
    await appendProgressRecord({
      dir: target,
      basename: 'run',
      record: second,
    });

    const lines = readFileSync(join(target, progressFileName('run')), 'utf8')
      .trimEnd()
      .split('\n');
    expect(progressFileName('run')).toBe('run.partial.jsonl');
    expect(lines.map((line) => JSON.parse(line))).toEqual([record, second]);
  });
});
