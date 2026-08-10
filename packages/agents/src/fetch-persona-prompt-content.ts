import type { PersonaId } from './persona-config.js';
import type { AppLogger } from '@moe/core';

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves `personas/<id>/prompt.md` relative to this module's own compiled location, not
 * `src/` — `packages/agents`'s own `build` script copies `src/personas` into `dist/personas`
 * specifically so this stays self-contained under `dist/`, matching `package.json`'s own
 * `"files": ["dist"]` declaration instead of depending on the Dockerfile happening to ship more
 * than that (BUILD_PLAN 5.3a-ii).
 *
 * Returns `undefined`, never throws, on any read failure — including any persona with no
 * `prompt.md` yet, which every caller here treats identically to a broken copy step (fall back to
 * the existing generic default). There's no caller-relevant category to branch on between those
 * cases (`docs/CONVENTIONS.md` §Error Handling reserves `Result` for failures with more than one
 * meaningfully different outcome), so this mirrors `resolvePersonaModel`'s own bare-value shape
 * rather than wrapping defensively. `ENOENT` specifically (no `prompt.md` for this persona yet) is
 * silent, since it's expected on every turn for whichever personas haven't reached their own 5.3
 * sub-chunk yet — anything else (permissions, a broken `dist/personas` copy in production) is a
 * real infra regression indistinguishable from "not drafted yet" by return value alone, so it's
 * logged via the optional `logger` (DA review, BUILD_PLAN 5.3a-ii PR 1) rather than masked with
 * zero signal.
 */
export async function fetchPersonaPromptContent(
  personaId: PersonaId,
  logger?: AppLogger,
): Promise<string | undefined> {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    'personas',
    personaId,
    'prompt.md',
  );
  try {
    const content = await readFile(path, 'utf8');
    return content.trim();
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error
        ? // Safe: `'code' in error` already narrows to an object carrying that property; the cast
          // only adds Node's own typed name (`NodeJS.ErrnoException`) for the fs-error-code shape.
          (error as NodeJS.ErrnoException).code
        : undefined;
    if (code !== 'ENOENT') {
      logger?.warn(
        'failed to read persona prompt.md (not a missing-file case)',
        {
          personaId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      );
    }
    return undefined;
  }
}
