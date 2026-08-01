import { describe, expect, it, vi } from 'vitest';

import { fetchPersonaPromptContent } from './fetch-persona-prompt-content.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('fetchPersonaPromptContent', () => {
  it("returns Sarah's real, trimmed prompt.md content", async () => {
    const content = await fetchPersonaPromptContent('sarah');

    expect(content).toContain("You're moe's PM and the team's front door");
    expect(content).toBe(content?.trim());
  });

  it('returns undefined for a persona with no prompt.md directory yet', async () => {
    const content = await fetchPersonaPromptContent('marcus');

    expect(content).toBeUndefined();
  });

  it('does not warn for the expected ENOENT case (a persona with no prompt.md yet)', async () => {
    const logger = makeLogger();

    await fetchPersonaPromptContent('marcus', logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns, but still returns undefined, on a non-ENOENT read failure (a real infra regression, not an unwritten persona)', async () => {
    vi.resetModules();
    vi.doMock('node:fs/promises', () => ({
      readFile: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('permission denied'), { code: 'EACCES' }),
        ),
    }));
    const { fetchPersonaPromptContent: fetchWithMockedFs } =
      await import('./fetch-persona-prompt-content.js');
    const logger = makeLogger();

    const content = await fetchWithMockedFs('sarah', logger);

    expect(content).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'failed to read persona prompt.md (not a missing-file case)',
      expect.objectContaining({
        personaId: 'sarah',
        errorMessage: expect.any(String),
      }),
    );
    vi.doUnmock('node:fs/promises');
    vi.resetModules();
  });
});
