// Imports this package's own BUILT output (../dist), same reasoning `scripts/
// discover-github-issues.ts`'s own header comment documents — Node's native TypeScript execution
// doesn't resolve `.js` specifiers back to sibling `.ts` source for relative imports. Requires
// `pnpm build` to have run first — the `create:github-issues` script does that automatically.
import {
  claimTicketForIssueCreation,
  createDb,
  createPool,
  listStuckPendingTicketGithubIssueLinks,
  listTicketsWithoutGithubIssueLink,
  parseDatabaseConfig,
  releaseTicketGithubIssueClaim,
  resolveTicketGithubIssueLink,
} from '@moe/core';
import {
  createGithubClient,
  createGithubIssue,
  parseGithubConfig,
} from '@moe/github';

import { createGithubIssuesForTickets } from '../dist/create-github-issues-for-tickets.js';
import { createLogger } from '../dist/logger.js';

// Only the two fields this script's own logger could ever see — same scoped-down precedent
// `scripts/discover-github-issues.ts` already sets.
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

await createGithubIssuesForTickets({
  logger,
  // Sarah is the only wired persona today (VISION §4.1, BUILD_PLAN 5.3 — the rest of the cast's
  // prompts/voices aren't built yet) and the front-door owner of chat-born ticket intake
  // (BUILD_PLAN chunks 2.x-3.x). Hardcoded here rather than threaded through env/config, same as
  // `handle-ambient-channel-message.ts`'s own `severity: 'Medium'` placeholder — a real choice to
  // revisit once a second persona's own tickets need attributing to someone other than Sarah.
  personaId: 'sarah',
  repo: parsedGithub.config.repo,
  githubClient: {
    createIssue: (params) =>
      createGithubIssue(githubClient, parsedGithub.config.repo, params),
  },
  linkStore: {
    listUnlinkedTickets: () => listTicketsWithoutGithubIssueLink(db),
    listStuckPending: () => listStuckPendingTicketGithubIssueLinks(db),
    claim: (input) => claimTicketForIssueCreation(db, input),
    resolve: (ticketId, resolved) =>
      resolveTicketGithubIssueLink(db, ticketId, resolved),
    release: (ticketId) => releaseTicketGithubIssueClaim(db, ticketId),
  },
});

await pool.end();
console.log('GitHub issue creation complete.');
