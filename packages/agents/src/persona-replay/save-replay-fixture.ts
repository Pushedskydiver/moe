import type { ReplayFixture } from './replay-fixture.js';

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Writes a recorded fixture as committed, reviewable JSON (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
 * decision 2) — called only by `record-persona-replay.ts`. Pretty-printed so a `git diff` on a
 * re-recorded fixture reads as a real transcript diff, not a one-line JSON blob.
 */
export async function saveReplayFixture(
  path: string,
  fixture: ReplayFixture,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
}
