// Regenerates the repo-root `fly.<persona>.toml` fleet from `packages/core/src/deploy/`
// (BUILD_PLAN 5.2). Run `pnpm --filter @moe/core generate:fly-configs`; CI's `fly-configs-
// freshness` job fails the build if the committed files drift from what this emits.
//
// Imports the package's own BUILT output (../dist), matching migrate.ts's own precedent — see
// that file's comment for why Node-native TS execution requires this.
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFlyAppConfig, personaIdSchema } from '../dist/index.js';

// packages/core/scripts → packages/core → packages → repo root. The configs live at the repo
// root because `fly deploy`'s `--config` path resolves against its working-directory argument,
// which defaults to the current directory — so `fly deploy -c fly.sarah.toml` run from the root
// finds both the config and the Dockerfile it builds from.
const REPO_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const configs = personaIdSchema.options.map((personaId) =>
  buildFlyAppConfig(personaId),
);
const expected = new Set(configs.map(({ fileName }) => fileName));

// Sweep orphans before writing, so removing a persona from the roster actually removes its config
// rather than leaving a stale file behind. Without this the CI freshness gate cannot see roster
// *shrinkage* at all: a write-only generator leaves the orphan untouched, so `git add -A` finds
// nothing to stage and the gate passes on real drift.
//
// This claims the whole root `fly.<name>.toml` namespace for the generator: any file matching it
// that isn't a current persona's is deleted, including untracked ones git could not restore. Don't
// hand-author a `fly.staging.toml` here. A bare root `fly.toml` is deliberately outside the pattern
// (`.+` needs a middle segment), so re-adding one wouldn't be destroyed by a regenerate.
for (const entry of readdirSync(REPO_ROOT, { withFileTypes: true })) {
  // `isFile()` guard: a *directory* named fly.x.toml would make rmSync throw ERR_FS_EISDIR and
  // abort the whole generator — and the CI job with it — on a raw stack trace.
  if (
    entry.isFile() &&
    /^fly\..+\.toml$/.test(entry.name) &&
    !expected.has(entry.name)
  ) {
    rmSync(join(REPO_ROOT, entry.name));
    console.log(`removed orphaned ${entry.name}`);
  }
}

for (const { fileName, toml } of configs) {
  writeFileSync(join(REPO_ROOT, fileName), toml, 'utf8');
  console.log(`wrote ${fileName}`);
}
