import { describe, expect, it } from 'vitest';

import { resolvePersonaModel } from './resolve-persona-model.js';

describe('resolvePersonaModel', () => {
  it.each([
    'sarah',
    'marcus',
    'riley',
    'priya',
    'dom',
    'theo',
    'nia',
    'maya',
  ] as const)(
    'resolves %s to claude-sonnet-5, the VISION §10 Sonnet-by-default, absent a persona-specific override',
    (personaId) => {
      expect(resolvePersonaModel(personaId)).toBe('claude-sonnet-5');
    },
  );
});
