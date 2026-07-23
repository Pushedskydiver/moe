import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * BUILD_PLAN 4.4b's outbound ticket→GitHub-issue link — `ticketId` is the natural primary key (a
 * ticket maps to at most one GitHub issue, same 1:1 reasoning `sweep-state.ts`'s own
 * `personaId`-keyed table uses for its own natural key). `repoOwner`/`repoName` are known and set
 * at claim time (moe's own single-configured-repo scope, `docs/GLOSSARY.md`'s "GitHub issue
 * discovery" entry); `issueNumber`/`issueUrl` are unknown until GitHub's own `issues.create`
 * response resolves them, so both stay nullable until `resolvedAt` is set — mirrors
 * `pending-ticket-draft.ts`'s own `resolvedAt`-gated CAS shape, not `github-issue-triage-entry.ts`'s
 * plain upsert-mirror shape, since this row's own lifecycle is a genuine two-phase
 * claim-then-resolve (a real GitHub API call sits in between) rather than a stateless re-poll.
 */
export const ticketGithubIssueLinkSchema = z.object({
  ticketId: z.uuid(),
  repoOwner: nonBlankStringSchema,
  repoName: nonBlankStringSchema,
  issueNumber: z.number().int().positive().nullable(),
  issueUrl: nonBlankStringSchema.nullable(),
  resolvedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type TicketGithubIssueLink = z.infer<typeof ticketGithubIssueLinkSchema>;
