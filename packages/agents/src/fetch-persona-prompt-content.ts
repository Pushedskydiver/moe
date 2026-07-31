import type { PersonaId } from './persona-config.js';

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
 * Returns `undefined`, never throws, on any read failure — including the 7 personas with no
 * `prompt.md` yet, which every caller here treats identically to a broken copy step (fall back to
 * the existing generic default). There's no caller-relevant category to branch on between those
 * cases (`docs/CONVENTIONS.md` §Error Handling reserves `Result` for failures with more than one
 * meaningfully different outcome), so this mirrors `resolvePersonaModel`'s own bare-value shape
 * rather than wrapping defensively.
 */
export async function fetchPersonaPromptContent(
  personaId: PersonaId,
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
  } catch {
    return undefined;
  }
}
