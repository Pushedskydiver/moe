// Imports this package's own BUILT output (../dist), same reasoning `scripts/
// create-github-issues.ts`'s own header comment documents — Node's native TypeScript execution
// doesn't resolve `.js` specifiers back to sibling `.ts` source for relative imports. Requires
// `pnpm build` to have run first — the `reconcile:github-issues` script does that automatically.
import {
  createDb,
  createPool,
  getTicketById,
  listResolvedTicketGithubIssueLinks,
  parseDatabaseConfig,
  updateTicket,
} from '@moe/core';
import {
  createGithubClient,
  getGithubIssueState,
  parseGithubConfig,
} from '@moe/github';

import { createLogger } from '../dist/logger.js';
import { reconcileGithubIssues } from '../dist/reconcile-github-issues.js';

// Only the two fields this script's own logger could ever see — same scoped-down precedent
// `scripts/create-github-issues.ts` already sets.
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

await reconcileGithubIssues({
  logger,
  repo: parsedGithub.config.repo,
  githubClient: {
    getIssueState: (issueNumber) =>
      getGithubIssueState(githubClient, parsedGithub.config.repo, issueNumber),
  },
  linkStore: {
    listResolved: () => listResolvedTicketGithubIssueLinks(db),
  },
  ticketStore: {
    getById: (id) => getTicketById(db, id),
    update: (id, patch) => updateTicket(db, id, patch),
  },
});

await pool.end();
console.log('GitHub issue reconciliation complete.');
