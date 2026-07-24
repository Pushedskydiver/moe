// Imports this package's own BUILT output (../dist), same reasoning `scripts/
// create-github-issues.ts`'s own header comment documents — Node's native TypeScript execution
// doesn't resolve `.js` specifiers back to sibling `.ts` source for relative imports. Requires
// `pnpm build` to have run first — the `provision:slack-apps` script does that automatically.
import { personaIdSchema } from '@moe/core';
import {
  createManifestClient,
  parseManifestProvisioningConfig,
  parseProvisionPersonaIds,
} from '@moe/slack';

import { createLogger } from '../dist/logger.js';
import { provisionSlackApps } from '../dist/provision-slack-apps.js';

// This script's own config has exactly one field, and it's a real credential — `docs/CONVENTIONS.md`
// §External API Integration Patterns names the "forgot the key-based redaction half" gap as having
// already bitten this codebase twice; wiring both mechanisms from the start closes a third instance.
const SECRET_KEYS = ['configToken'];

const logger = createLogger({ secretKeys: SECRET_KEYS });

const parsedConfig = parseManifestProvisioningConfig(process.env);
if (!parsedConfig.ok) {
  logger.error('invalid manifest provisioning config', {
    issues: parsedConfig.error.issues,
  });
  process.exit(1);
}

const manifestClient = createManifestClient(
  parsedConfig.config.configToken,
  logger,
);

// Sarah already has a real, live Slack app (`docs/VISION.md` §4.1) — every other roster member
// needs one, by default. `apps.manifest.create` has no natural-key dedup, so re-running this
// script's own default (every non-Sarah persona) after a partial-batch failure would create
// duplicate real Slack apps for whichever personas already succeeded (DA review's own MATERIAL
// finding) — `MOE_SLACK_PROVISION_PERSONA_IDS` (comma-separated) lets Alex target only the
// personas still actually needing a real app on a retry.
const defaultPersonaIds = personaIdSchema.options.filter(
  (id) => id !== 'sarah',
);
const parsedPersonaIds = parseProvisionPersonaIds(
  process.env.MOE_SLACK_PROVISION_PERSONA_IDS,
  defaultPersonaIds,
);
if (!parsedPersonaIds.ok) {
  logger.error('invalid persona id in MOE_SLACK_PROVISION_PERSONA_IDS', {
    rawId: parsedPersonaIds.error.rawId,
  });
  process.exit(1);
}
const personaIds = parsedPersonaIds.personaIds;

await provisionSlackApps({
  logger,
  manifestClient,
  personaIds,
  waitMs: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

console.log('Slack app provisioning run complete.');
