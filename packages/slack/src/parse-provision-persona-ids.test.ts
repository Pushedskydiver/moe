import { describe, expect, it } from 'vitest';

import { parseProvisionPersonaIds } from './parse-provision-persona-ids.js';

const DEFAULT_IDS = ['marcus', 'riley', 'priya'] as const;

describe('parseProvisionPersonaIds', () => {
  it('falls back to the default ids when no override is given', () => {
    const result = parseProvisionPersonaIds(undefined, DEFAULT_IDS);

    expect(result).toEqual({ ok: true, personaIds: DEFAULT_IDS });
  });

  it('falls back to the default ids when the override is a blank string', () => {
    const result = parseProvisionPersonaIds('   ', DEFAULT_IDS);

    expect(result).toEqual({ ok: true, personaIds: DEFAULT_IDS });
  });

  it('parses a comma-separated override, trimming whitespace', () => {
    const result = parseProvisionPersonaIds(' dom, theo ,nia', DEFAULT_IDS);

    expect(result).toEqual({ ok: true, personaIds: ['dom', 'theo', 'nia'] });
  });

  it('parses a single-id override', () => {
    const result = parseProvisionPersonaIds('maya', DEFAULT_IDS);

    expect(result).toEqual({ ok: true, personaIds: ['maya'] });
  });

  it('returns ok:false with the offending raw id when the override contains an invalid persona id', () => {
    const result = parseProvisionPersonaIds('dom,zara,theo', DEFAULT_IDS);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalid-persona-id', rawId: 'zara' },
    });
  });
});
