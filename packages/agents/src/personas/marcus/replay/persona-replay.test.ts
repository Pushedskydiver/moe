import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fetchPersonaPromptContent } from '../../../fetch-persona-prompt-content.js';
import { loadReplayFixture } from '../../../persona-replay/load-replay-fixture.js';
import { verifyReplayFixture } from '../../../persona-replay/verify-replay-fixture.js';
import { resolvePersonaModel } from '../../../resolve-persona-model.js';
import { scenarios } from './scenarios.js';

const PERSONA_ID = 'marcus';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('marcus persona replay', () => {
  it.each(scenarios)('$id — $description', async (scenario) => {
    const promptContent = await fetchPersonaPromptContent(PERSONA_ID);
    const fixture = await loadReplayFixture(
      join(FIXTURES_DIR, `${scenario.id}.json`),
    );

    const result = verifyReplayFixture({
      scenario,
      fixture,
      currentPromptContent: promptContent ?? '',
      currentModel: resolvePersonaModel(PERSONA_ID),
      personaId: PERSONA_ID,
    });

    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
