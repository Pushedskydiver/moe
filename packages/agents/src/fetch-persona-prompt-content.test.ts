import { afterEach, describe, expect, it, vi } from 'vitest';

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

  // Mocked rather than pointed at a real undrafted persona (BUILD_PLAN 5.3h) — the full 8-name
  // roster now has a real prompt.md each, so there is no persona left whose actual on-disk state
  // exercises this path. Mocking `readFile`'s own ENOENT makes this case permanent instead of
  // depending on some future persona staying perpetually undrafted.
  describe('a persona with no prompt.md yet (mocked ENOENT, not a real on-disk gap)', () => {
    afterEach(() => {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
    });

    it('returns undefined', async () => {
      vi.resetModules();
      vi.doMock('node:fs/promises', () => ({
        readFile: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('no such file'), { code: 'ENOENT' }),
          ),
      }));
      const { fetchPersonaPromptContent: fetchWithMockedFs } =
        await import('./fetch-persona-prompt-content.js');

      const content = await fetchWithMockedFs('sarah');

      expect(content).toBeUndefined();
    });

    it('does not warn for the expected ENOENT case', async () => {
      vi.resetModules();
      vi.doMock('node:fs/promises', () => ({
        readFile: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('no such file'), { code: 'ENOENT' }),
          ),
      }));
      const { fetchPersonaPromptContent: fetchWithMockedFs } =
        await import('./fetch-persona-prompt-content.js');
      const logger = makeLogger();

      await fetchWithMockedFs('sarah', logger);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('a non-ENOENT read failure (a real infra regression, not an unwritten persona)', () => {
    afterEach(() => {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
    });

    it('warns, but still returns undefined', async () => {
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
    });
  });
});
