import { describe, expect, it } from 'vitest';

// Deliberately imports the package's own BUILT output (`../dist`), not `../src` —
// `fetch-persona-prompt-content.ts` resolves `personas/<id>/prompt.md` relative to its own
// compiled module location, which only works once `packages/agents`'s `build` script has
// actually copied `src/personas` into `dist/personas` (BUILD_PLAN 5.3a-ii). Every other test in
// this package runs against `src/` directly (vitest transpiles `.ts` in place), so none of them
// would catch a broken copy step — this is the one test that would. Requires `pnpm build` to
// have run first, same precondition `packages/core/scripts/migrate.ts` documents for its own
// dist-importing pattern.
import { buildPersonaSystemPrompt } from '../dist/index.js';

describe('packages/agents built dist output', () => {
  it("ships Sarah's real prompt.md content, proving the build's src/personas → dist/personas copy step actually ran", async () => {
    const blocks = await buildPersonaSystemPrompt('sarah');
    const text = blocks[0]?.text ?? '';

    expect(text).toContain("You're moe's PM and the team's front door");
  });
});
