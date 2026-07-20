// Imports this package's own BUILT output (../dist), same reasoning `packages/core/scripts/
// migrate.ts`'s own header comment documents — Node's native TypeScript execution doesn't
// resolve `.js` specifiers back to sibling `.ts` source for relative imports (only works once the
// `.js` file genuinely exists on disk). Requires `pnpm build` to have run first — the
// `sweep:review-queue` script does that automatically.
import { parsePersonaConfig } from '@moe/agents';
import {
  createDb,
  createPool,
  findStaleUnresolvedConfirmingQuestions,
  getDraftOutcomeCounts,
  getSweepState,
  listReviewQueueEntriesSince,
  parseDatabaseConfig,
  recordSweepCompleted,
  resolveConfirmingQuestionAndLog,
} from '@moe/core';
import { createWebClient } from '@moe/slack';

import { createLogger } from '../dist/logger.js';
import { runReviewQueueSweep } from '../dist/review-queue-sweep.js';

// Only the two fields this script's own logger could ever see — not `main.ts`'s own broader
// `SECRET_KEYS` list (unexported, and this script never touches the Anthropic key or signing
// secret it also redacts).
const SECRET_KEYS = ['slackBotToken', 'connectionString'];

const logger = createLogger({ secretKeys: SECRET_KEYS });

const parsedPersona = parsePersonaConfig(process.env);
if (!parsedPersona.ok) {
  logger.error('invalid persona config', {
    issues: parsedPersona.error.issues,
  });
  process.exit(1);
}

const parsedDatabase = parseDatabaseConfig(process.env);
if (!parsedDatabase.ok) {
  logger.error('invalid database config', {
    issues: parsedDatabase.error.issues,
  });
  process.exit(1);
}

// Reused as a bare string, not routed through `@moe/agents`'s own `parseCostCapConfig` — Alex
// confirmed via `AskUserQuestion` the same DM audience as the cost-cap alert ladder, but this
// script has no cost-cap concern of its own (`MOE_COST_CAP_MONTHLY`) to justify pulling in that
// whole config bundle for one shared field.
const alertSlackUserId = process.env.MOE_COST_ALERT_SLACK_USER_ID;
if (!alertSlackUserId) {
  logger.error('MOE_COST_ALERT_SLACK_USER_ID is not set');
  process.exit(1);
}

const pool = createPool(parsedDatabase.config.connectionString);
const db = createDb(pool);
const slackClient = createWebClient(parsedPersona.config.slackBotToken, logger);

await runReviewQueueSweep(
  {
    personaId: parsedPersona.config.id,
    alertSlackUserId,
    logger,
    slackClient,
    sweepStateStore: {
      getSweepState: (personaId) => getSweepState(db, personaId),
      recordSweepCompleted: (input) => recordSweepCompleted(db, input),
    },
    reviewQueueStore: {
      listSince: (scope) => listReviewQueueEntriesSince(db, scope),
    },
    confirmingQuestionStore: {
      findStale: (scope) => findStaleUnresolvedConfirmingQuestions(db, scope),
      resolveAndLog: (input) => resolveConfirmingQuestionAndLog(db, input),
    },
    draftStore: {
      getOutcomeCounts: (scope) => getDraftOutcomeCounts(db, scope),
    },
  },
  new Date(),
);

await pool.end();
console.log('Review-queue sweep complete.');
