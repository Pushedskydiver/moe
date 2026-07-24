// Regenerates the repo-root `fly.<persona>.toml` fleet from `packages/core/src/deploy/`
// (BUILD_PLAN 5.2). Run `pnpm --filter @moe/core generate:fly-configs`; CI's `fly-configs-
// freshness` job fails the build if the committed files drift from what this emits.
//
// Imports the package's own BUILT output (../dist), matching migrate.ts's own precedent — see
// that file's comment for why Node-native TS execution requires this.
import { writeFileSync } from 'node:fs';
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

for (const personaId of personaIdSchema.options) {
  const { fileName, toml } = buildFlyAppConfig(personaId);
  writeFileSync(join(REPO_ROOT, fileName), toml, 'utf8');
  console.log(`wrote ${fileName}`);
}
