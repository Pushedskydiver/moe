import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadReplayFixture } from './load-replay-fixture.js';

describe('loadReplayFixture', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'moe-replay-fixture-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns undefined when no fixture file exists at the given path', async () => {
    const result = await loadReplayFixture(join(dir, 'missing.json'));
    expect(result).toBeUndefined();
  });

  it('returns the parsed fixture when the file is well-formed', async () => {
    const path = join(dir, 'ok.json');
    writeFileSync(
      path,
      JSON.stringify({
        scenarioId: 'a-scenario',
        personaId: 'sarah',
        callSite: 'dmReply',
        promptContentHash: 'a'.repeat(64),
        scenarioInputHash: 'b'.repeat(64),
        model: 'claude-sonnet-5',
        recordedAt: '2026-08-09T12:00:00.000Z',
        stopReason: 'end_turn',
        outputTokensRaw: 5,
        result: {
          ok: true,
          reply: 'hi',
          toolUses: [],
          usage: { inputTokens: 1, outputTokens: 5 },
        },
      }),
    );

    const result = await loadReplayFixture(path);
    expect(result?.scenarioId).toBe('a-scenario');
  });

  it('throws when the file exists but is not valid JSON', async () => {
    const path = join(dir, 'bad-json.json');
    writeFileSync(path, '{not json');
    await expect(loadReplayFixture(path)).rejects.toThrow();
  });

  it('throws when the file is valid JSON but fails schema validation', async () => {
    const path = join(dir, 'bad-schema.json');
    writeFileSync(path, JSON.stringify({ scenarioId: 'x' }));
    await expect(loadReplayFixture(path)).rejects.toThrow(
      /corrupted replay fixture/,
    );
  });
});
