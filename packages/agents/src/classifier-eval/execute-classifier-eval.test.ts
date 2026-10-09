import type { Anthropic } from '@anthropic-ai/sdk';

import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeClassifierEval } from './execute-classifier-eval.js';

const SETS_DIR = fileURLToPath(
  new URL('../../classifier-eval/sets', import.meta.url),
);

function makeMessage(text: string): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5',
    container: null,
    content: [{ type: 'text', text, citations: null }],
    stop_details: null,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 100,
      output_tokens: 20,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

// Answers by which production prompt asked, never by calling any API.
function fakeCreate(params: Anthropic.MessageCreateParamsNonStreaming) {
  return Promise.resolve(
    makeMessage(
      typeof params.system === 'string' &&
        params.system.includes('safety check')
        ? JSON.stringify({ appropriate: true, reasoning: 'routine' })
        : JSON.stringify({ confidence: 50, reasoning: 'unsure' }),
    ),
  );
}

describe('executeClassifierEval', () => {
  let resultsDir: string;

  beforeEach(() => {
    resultsDir = mkdtempSync(join(tmpdir(), 'moe-execute-classifier-eval-'));
  });

  afterEach(() => {
    rmSync(resultsDir, { recursive: true, force: true });
  });

  it('runs the committed sets under all four configurations three times each, and writes the results JSON and table', async () => {
    const create = vi.fn(fakeCreate);
    const log = vi.fn();

    const result = await executeClassifierEval({
      client: { messages: { create } },
      setsDir: SETS_DIR,
      resultsDir,
      log,
    });

    // (18 + 24 + 12) messages x 4 configurations x 3 runs.
    expect(create).toHaveBeenCalledTimes(54 * 4 * 3);
    expect(result.ok).toBe(true);
    const names = readdirSync(resultsDir);
    expect(names).toHaveLength(2);
    expect(
      names.every((name) =>
        /^classifier-eval-\d{4}-\d{2}-\d{2}\.(json|md)$/.test(name),
      ),
    ).toBe(true);
  });

  it('writes a results file holding every call and the sets with their expected labels', async () => {
    const result = await executeClassifierEval({
      client: { messages: { create: vi.fn(fakeCreate) } },
      setsDir: SETS_DIR,
      resultsDir,
      log: vi.fn(),
    });
    if (!result.ok) throw new Error(result.error.message);

    const saved = JSON.parse(readFileSync(result.jsonPath, 'utf8')) as {
      calls: unknown[];
      sets: { id: string }[];
    };
    expect(saved.calls).toHaveLength(648);
    expect(saved.sets.map((set) => set.id)).toEqual([
      'addendum-18',
      'rebuilt-24',
      'safety-gate-12',
    ]);
    expect(readFileSync(result.markdownPath, 'utf8')).toContain(
      '## safety-gate-12',
    );
  });

  it('logs progress per call and a totals line per configuration', async () => {
    const log = vi.fn();

    await executeClassifierEval({
      client: { messages: { create: vi.fn(fakeCreate) } },
      setsDir: SETS_DIR,
      resultsDir,
      log,
    });

    const lines = log.mock.calls.map(([line]) => String(line));
    expect(
      lines.some((line) =>
        line.startsWith('[1/648] A addendum-18/addendum-01 run 1:'),
      ),
    ).toBe(true);
    expect(
      lines.some((line) => line.startsWith('[648/648] D safety-gate-12/')),
    ).toBe(true);
    expect(
      lines.filter((line) => line.startsWith('Configuration ')).length,
    ).toBe(4);
  });

  it('appends each call to a progress file as it lands, and leaves it behind when the run is cut short', async () => {
    const log = vi.fn((line: string) => {
      if (line.startsWith('[5/648]')) throw new Error('interrupted');
    });

    await expect(
      executeClassifierEval({
        client: { messages: { create: vi.fn(fakeCreate) } },
        setsDir: SETS_DIR,
        resultsDir,
        log,
      }),
    ).rejects.toThrow('interrupted');

    const names = readdirSync(resultsDir);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(
      /^classifier-eval-\d{4}-\d{2}-\d{2}\.partial\.jsonl$/,
    );
    const lines = readFileSync(join(resultsDir, names[0] ?? ''), 'utf8')
      .trimEnd()
      .split('\n');
    expect(lines).toHaveLength(5);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      configurationId: 'A',
      setId: 'addendum-18',
      messageId: 'addendum-01',
      run: 1,
    });
  });

  it("doesn't overwrite an earlier run's results on the same day", async () => {
    const first = await executeClassifierEval({
      client: { messages: { create: vi.fn(fakeCreate) } },
      setsDir: SETS_DIR,
      resultsDir,
      log: vi.fn(),
    });
    const second = await executeClassifierEval({
      client: { messages: { create: vi.fn(fakeCreate) } },
      setsDir: SETS_DIR,
      resultsDir,
      log: vi.fn(),
    });

    expect(first.ok && second.ok && first.jsonPath !== second.jsonPath).toBe(
      true,
    );
    expect(readdirSync(resultsDir)).toHaveLength(4);
  });

  it('makes no API call when a set file is missing or invalid, and returns the failure', async () => {
    const brokenSetsDir = join(resultsDir, 'sets');
    mkdirSync(brokenSetsDir);
    writeFileSync(join(brokenSetsDir, 'addendum-18.json'), '{ not json');
    const create = vi.fn(fakeCreate);

    const result = await executeClassifierEval({
      client: { messages: { create } },
      setsDir: brokenSetsDir,
      resultsDir: join(resultsDir, 'out'),
      log: vi.fn(),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unreadable-eval-set' },
    });
    expect(create).not.toHaveBeenCalled();
  });
});
