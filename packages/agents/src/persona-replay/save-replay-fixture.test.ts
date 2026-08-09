import type { ReplayFixture } from './replay-fixture.js';

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { saveReplayFixture } from './save-replay-fixture.js';

function fixture(): ReplayFixture {
  return {
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
  };
}

describe('saveReplayFixture', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'moe-save-replay-fixture-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates parent directories that do not exist yet', async () => {
    const path = join(dir, 'nested', 'fixtures', 'a-scenario.json');
    await saveReplayFixture(path, fixture());
    expect(existsSync(path)).toBe(true);
  });

  it('writes JSON that round-trips back to the same fixture', async () => {
    const path = join(dir, 'a-scenario.json');
    await saveReplayFixture(path, fixture());
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written).toEqual(fixture());
  });

  it('overwrites an existing fixture file at the same path', async () => {
    const path = join(dir, 'a-scenario.json');
    await saveReplayFixture(path, fixture());
    await saveReplayFixture(path, { ...fixture(), stopReason: null });
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.stopReason).toBeNull();
  });

  it('writes human-readable (indented, newline-terminated) JSON', async () => {
    const path = join(dir, 'a-scenario.json');
    await saveReplayFixture(path, fixture());
    const raw = readFileSync(path, 'utf8');
    expect(raw).toContain('\n');
    expect(raw.endsWith('\n')).toBe(true);
  });
});
