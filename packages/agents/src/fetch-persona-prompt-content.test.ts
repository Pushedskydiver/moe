import { describe, expect, it } from 'vitest';

import { fetchPersonaPromptContent } from './fetch-persona-prompt-content.js';

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
});
