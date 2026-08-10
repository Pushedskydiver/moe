import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildPersonaSystemPrompt,
  PLACEHOLDER_SYSTEM_PROMPT,
} from './placeholder-system-prompt.js';

// The full 8-name roster (`packages/core/src/persona-roster.ts`) — 'maya' (Designer, activated
// BUILD_PLAN chunk 5.0) was missing here (copilot-surrogate, PR #84), which meant this test
// couldn't have caught a leak of her name into the fallback prompt.
const ROSTER_NAMES = [
  'sarah',
  'marcus',
  'riley',
  'priya',
  'dom',
  'theo',
  'nia',
  'maya',
];

describe('PLACEHOLDER_SYSTEM_PROMPT', () => {
  it('is non-empty', () => {
    expect(PLACEHOLDER_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('names no roster persona — this is the no-persona-context fallback, not the persona voice (Stage 5 gate)', () => {
    const lower = PLACEHOLDER_SYSTEM_PROMPT.toLowerCase();
    ROSTER_NAMES.forEach((name) => {
      expect(lower).not.toContain(name);
    });
  });
});

describe('buildPersonaSystemPrompt', () => {
  it('returns a single system block with a cache_control marker on it', async () => {
    const blocks = await buildPersonaSystemPrompt('priya');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[0]?.cache_control).toEqual({ type: 'ephemeral' });
  });

  describe('when the persona has no prompt.md yet (placeholder fallback)', () => {
    it('names the given persona, capitalized, as its identity in this context', async () => {
      const blocks = await buildPersonaSystemPrompt('priya');
      const text = blocks[0]?.text ?? '';

      expect(text.toLowerCase()).toContain('priya');
      expect(text).toContain('Priya');
    });

    it('produces a different prompt per persona, not a shared hardcoded name', async () => {
      const priya = await buildPersonaSystemPrompt('priya');
      const dom = await buildPersonaSystemPrompt('dom');

      expect(priya[0]?.text).not.toEqual(dom[0]?.text);
      expect(dom[0]?.text).toContain('Dom');
    });

    it("tells the model not to correct someone who uses its name — doesn't deny the persona identity", async () => {
      const blocks = await buildPersonaSystemPrompt('priya');
      const lower = (blocks[0]?.text ?? '').toLowerCase();

      expect(lower).toContain('no need to correct');
    });

    it('does not claim a defined personality or voice — that stays Stage 5', async () => {
      const blocks = await buildPersonaSystemPrompt('priya');
      const lower = (blocks[0]?.text ?? '').toLowerCase();

      expect(lower).toContain("don't have a defined personality or voice");
      expect(lower).not.toContain('you have a personality');
      expect(lower).not.toContain('your personality is');
    });

    it('does not claim to have or lack memory of past conversations — that depends on what history the caller forwards, not a static claim in the prompt', async () => {
      const blocks = await buildPersonaSystemPrompt('priya');
      const lower = (blocks[0]?.text ?? '').toLowerCase();

      expect(lower).not.toContain('memory');
    });

    it('instructs the model to call report_status for a status claim rather than stating it directly (BUILD_PLAN 2.5)', async () => {
      const blocks = await buildPersonaSystemPrompt('priya');
      const lower = (blocks[0]?.text ?? '').toLowerCase();

      expect(lower).toContain('report_status');
    });
  });

  describe('when the persona has a real prompt.md (BUILD_PLAN 5.3a-ii)', () => {
    it("returns Sarah's real prompt content, not the generic placeholder template", async () => {
      const blocks = await buildPersonaSystemPrompt('sarah');
      const text = blocks[0]?.text ?? '';

      expect(text).toContain("You're moe's PM and the team's front door");
      expect(text).not.toContain("don't have a defined personality or voice");
    });
  });

  describe('logger threading to fetchPersonaPromptContent (DA review, R2 completeness finding)', () => {
    afterEach(() => {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
    });

    it("forwards its own logger param all the way to fetchPersonaPromptContent, so a real infra failure (not just an undrafted persona) is observable — regression coverage for the exact 'silently degrades to the placeholder' bug class R1 flagged", async () => {
      vi.resetModules();
      vi.doMock('node:fs/promises', () => ({
        readFile: vi.fn().mockRejectedValue(
          Object.assign(new Error('permission denied'), {
            code: 'EACCES',
          }),
        ),
      }));
      const { buildPersonaSystemPrompt: buildWithMockedFs } =
        await import('./placeholder-system-prompt.js');
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const blocks = await buildWithMockedFs('sarah', logger);

      // Still falls back to the generic template — a real infra failure never blocks a reply.
      expect(blocks[0]?.text).toContain('Sarah');
      expect(blocks[0]?.text).not.toContain(
        "You're moe's PM and the team's front door",
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'failed to read persona prompt.md (not a missing-file case)',
        expect.objectContaining({ personaId: 'sarah' }),
      );
    });
  });
});
