// Imports this package's own BUILT output (../dist), same reasoning `packages/core/scripts/
// migrate.ts`'s own header comment documents — Node's native TypeScript execution doesn't
// resolve `.js` specifiers back to sibling `.ts` source for relative imports (only works once the
// `.js` file genuinely exists on disk). Requires `pnpm build` to have run first — the
// `discover:github-issues` script does that automatically.
import {
  createDb,
  createPool,
  parseDatabaseConfig,
  upsertGithubIssueTriageEntry,
} from '@moe/core';
import {
  createGithubClient,
  listOpenIssues,
  parseGithubConfig,
} from '@moe/github';

import { discoverGithubIssues } from '../dist/discover-github-issues.js';
import { createLogger } from '../dist/logger.js';

// Only the two fields this script's own logger could ever see — not `main.ts`'s own broader
// `SECRET_KEYS` list (unexported, and this script never touches the Slack/Anthropic secrets it
// also redacts).
const SECRET_KEYS = ['privateKey', 'connectionString'];

const logger = createLogger({ secretKeys: SECRET_KEYS });

const parsedGithub = parseGithubConfig(process.env);
if (!parsedGithub.ok) {
  logger.error('invalid github config', { issues: parsedGithub.error.issues });
  process.exit(1);
}

const parsedDatabase = parseDatabaseConfig(process.env);
if (!parsedDatabase.ok) {
  logger.error('invalid database config', {
    issues: parsedDatabase.error.issues,
  });
  process.exit(1);
}

const pool = createPool(parsedDatabase.config.connectionString);
const db = createDb(pool);
const githubClient = createGithubClient(parsedGithub.config, logger);

await discoverGithubIssues(
  {
    logger,
    repo: parsedGithub.config.repo,
    githubClient: {
      listOpenIssues: (repo) => listOpenIssues(githubClient, repo),
    },
    triageStore: {
      upsert: (input) => upsertGithubIssueTriageEntry(db, input),
    },
  },
  new Date(),
);

await pool.end();
console.log('GitHub issue discovery complete.');
