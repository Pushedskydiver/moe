import type { ReplayFixture } from './replay-fixture.js';

import { readFile } from 'node:fs/promises';

import { parseReplayFixture } from './replay-fixture.js';

async function readFileIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/**
 * Reads and validates a committed replay fixture from an absolute path. Returns `undefined` only
 * when no fixture has been recorded yet (`ENOENT`) — mirroring `fetch-persona-prompt-content.ts`'s
 * own "missing is a normal, silent case" precedent. Any other failure (malformed JSON, a fixture
 * that fails schema validation) throws: a committed fixture is written only by
 * `record-persona-replay.ts`, so a corrupted one is an invariant violation
 * (`docs/CONVENTIONS.md` §Error Handling), not a case a caller should have to branch on.
 */
export async function loadReplayFixture(
  path: string,
): Promise<ReplayFixture | undefined> {
  const raw = await readFileIfExists(path);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = parseReplayFixture(JSON.parse(raw));
  if (!parsed.ok) {
    throw new Error(
      `corrupted replay fixture at ${path}: ${parsed.error.message}`,
    );
  }
  return parsed.fixture;
}
