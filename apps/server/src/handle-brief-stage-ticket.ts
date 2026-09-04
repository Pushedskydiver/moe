import type { CapStore } from './check-cost-cap.js';
import type { Logger } from './logger.js';
import type { PullLoopNeedsWorkCheck, PullLoopWorkStep } from './pull-loop.js';
import type { recordUsageLogged } from './record-usage-logged.js';
import type {
  Brief,
  composeBrief,
  CostCapConfig,
  PersonaId,
} from '@moe/agents';
import type {
  NewTicketBrief,
  Ticket,
  TicketBriefOrNullResult,
  TicketBriefResult,
  TicketGithubIssueLinkOrNullResult,
} from '@moe/core';
import type { getGithubIssueBody } from '@moe/github';
import type { addReaction } from '@moe/slack';

import { TEAM_CHANNEL_ID } from '@moe/core';
import { getGithubIssueBody as fetchGithubIssueBody } from '@moe/github';
import { postMessage } from '@moe/slack';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { composeBriefAndRecordUsage } from './compose-brief-and-record-usage.js';

// Re-derived locally the same way `compose-ticket-draft-and-record-usage.ts:15`/
// `handle-inbound-message.ts` already do for a module-private client shape — `PostMessageClient`
// is not itself exported from `packages/slack/src/post-message.ts`.
type PostMessageClient = Parameters<typeof postMessage>[0];
// Same local re-derivation, for the same reason — `AddReactionClient` is module-private in
// `packages/slack/src/add-reaction.ts`, never re-exported. Only its type is needed here (this
// work step never seeds a reaction itself), so this stays a type-only import.
type AddReactionClient = Parameters<typeof addReaction>[0];
// Derived from `recordUsageLogged`'s own deps type (`RecordUsageDeps`), not
// `checkCostCapAndAlert`'s (`CostCapDeps` has no `costStore` field at all — that field lives on
// `recordUsageLogged`'s deps type instead).
type CostStore = Parameters<typeof recordUsageLogged>[0]['costStore'];
// Same derivation shape as `compose-ticket-draft-and-record-usage.ts`'s own `ComposeDraftClient`.
type ComposeBriefClient = Parameters<typeof composeBrief>[0];
// Not a raw `Octokit` import — apps/server has no direct third-party-SDK dependency anywhere else
// in this package (every SDK-shaped client type in this file is re-derived from the one
// `@moe/*` function that actually uses it, same as `PostMessageClient`/`AddReactionClient` above);
// deriving from `getGithubIssueBody`'s own first parameter keeps that precedent rather than
// adding `octokit` as a new bare dependency just for this one type.
type GithubIssueBodyClient = Parameters<typeof getGithubIssueBody>[0];

export type BriefStageDeps = {
  readonly personaId: PersonaId;
  readonly logger: Logger;
  readonly anthropicClient: ComposeBriefClient;
  // Widened to satisfy `checkCostCapAndAlert`'s own `CostCapDeps.slackClient`
  // (`PostMessageClient & AddReactionClient`, the same `HandlerDeps.slackClient` shape) even
  // though this work step itself never seeds a reaction — the extra capability sits unused on
  // the type, same as every other `HandlerDeps`-shaped caller of `checkCostCapAndAlert`.
  readonly slackClient: PostMessageClient & AddReactionClient;
  readonly githubClient: GithubIssueBodyClient;
  readonly githubRepo: { readonly owner: string; readonly name: string };
  readonly costStore: CostStore;
  readonly capStore: CapStore;
  readonly costCapConfig: CostCapConfig;
  readonly briefStore: {
    readonly getByTicket: (
      ticketId: string,
    ) => Promise<TicketBriefOrNullResult>;
    readonly create: (input: NewTicketBrief) => Promise<TicketBriefResult>;
  };
  readonly issueLinkStore: {
    readonly getByTicket: (
      ticketId: string,
    ) => Promise<TicketGithubIssueLinkOrNullResult>;
  };
};

function formatBriefMessageText(ticketTitle: string, brief: Brief): string {
  const scopeLines = brief.scope.map((item) => `• ${item}`).join('\n');
  return `📝 *Brief: ${ticketTitle}*\n${brief.summary}\n\n${scopeLines}`;
}

/**
 * Resolves the optional GitHub issue body context for `composeBriefAndRecordUsage`, per §7's
 * "cheap DB read, always attempted (this is *how* provenance is discovered for content purposes,
 * not a branch on *whether* to compose)". A fetch failure logs a warning and falls back to
 * `undefined` (title-only composition) rather than aborting the tick — keeps the loop moving
 * instead of getting stuck on one ticket if GitHub is flaky. A link-read failure is treated the
 * same way (log, fall back), for the identical "don't get stuck on one ticket" reason — the
 * pull loop's own DB read failures already fail open elsewhere in this app (`checkCostCapAndAlert`
 * itself fails open on either of its own two reads).
 */
async function resolveIssueBody(
  deps: BriefStageDeps,
  ticket: Ticket,
): Promise<string | undefined> {
  const linkResult = await deps.issueLinkStore.getByTicket(ticket.id);
  if (!linkResult.ok) {
    deps.logger.warn('failed to look up github issue link for brief', {
      ticketId: ticket.id,
    });
    return undefined;
  }
  const link = linkResult.link;
  if (link === null || link.issueNumber === null) {
    return undefined;
  }

  const issue = await fetchGithubIssueBody(
    deps.githubClient,
    deps.githubRepo,
    link.issueNumber,
  );
  if (!issue.ok) {
    deps.logger.warn('failed to fetch github issue body for brief', {
      ticketId: ticket.id,
      issueNumber: link.issueNumber,
    });
    return undefined;
  }
  return issue.issue.body;
}

/**
 * Posts the composed brief to `#moe-team` and persists the `ticket_briefs` pointer on success —
 * extracted from `handleBriefStageTicket` purely to stay under eslint's `max-lines-per-function`
 * (`docs/CONVENTIONS.md` §Code Style: composition/sequencing code extracts aggressively). A post
 * failure logs and returns without persisting (nothing was written, so the idempotency check
 * won't block a retry next tick); a persist failure after a successful post logs but does not
 * throw — see `ticket-brief.ts`'s own TSDoc for the accepted residual-risk case this leaves.
 */
async function postBriefAndPersistPointer(
  deps: BriefStageDeps,
  ticket: Ticket,
  composed: Brief,
): Promise<void> {
  const posted = await postMessage(deps.slackClient, {
    channelId: TEAM_CHANNEL_ID,
    text: formatBriefMessageText(ticket.title, composed),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post brief to slack', {
      ticketId: ticket.id,
      errorMessage: posted.error.message,
    });
    return;
  }

  const created = await deps.briefStore.create({
    ticketId: ticket.id,
    channelId: TEAM_CHANNEL_ID,
    messageTs: posted.ts,
    summary: composed.summary,
    scope: composed.scope,
  });
  if (!created.ok) {
    deps.logger.error('failed to persist brief pointer after posting', {
      ticketId: ticket.id,
      channelId: TEAM_CHANNEL_ID,
      messageTs: posted.ts,
    });
  }
}

/**
 * BUILD_PLAN 6.1b's Brief-stage work step — composes an LLM brief for a ticket claimed out of
 * `Brief`, posts it to `#moe-team`, and persists a pointer so a later chunk (6.1d, out of scope
 * here) can find the message and drive the reaction-triggered `Brief`→`Plan` transition.
 *
 * **Idempotency-first, as the hard requirement it is** (§ "The hard constraint that shapes the
 * whole design"): the pull loop reclaims/reprocesses whatever's unclaimed in `Brief` every tick,
 * so this checks `briefStore.getByTicket` FIRST, before any LLM call, cost-cap read, or Slack
 * call — a pointer already existing means Sarah has already briefed this ticket, so this returns
 * immediately rather than spamming a duplicate post every tick forever. A failed idempotency
 * read itself also returns early (fails closed here, unlike the cost-cap reads below) — better to
 * skip a tick and retry than risk a duplicate post if the read's `ok:false` masked a real
 * already-briefed row.
 *
 * Otherwise cheapest-first: cost-cap check, then the (always-attempted) GitHub-provenance read,
 * then the real LLM call, then the Slack post, then the pointer write. A failure at any step
 * after the idempotency guard simply returns — the ticket stays `Brief`, unpointered, so it's a
 * natural retry candidate next tick, no special-casing needed (see `ticket-brief.ts`'s own TSDoc
 * for the one exception: a process crash between a successful post and the pointer INSERT, an
 * accepted residual risk deferred to BUILD_PLAN 6.6).
 */
export async function handleBriefStageTicket(
  deps: BriefStageDeps,
  ticket: Ticket,
): Promise<void> {
  const existing = await deps.briefStore.getByTicket(ticket.id);
  if (!existing.ok) {
    deps.logger.error('failed to check for an existing brief', {
      ticketId: ticket.id,
    });
    return;
  }
  if (existing.brief !== null) {
    deps.logger.info('ticket already briefed, skipping', {
      ticketId: ticket.id,
    });
    return;
  }

  const now = new Date();
  const capDecision = await checkCostCapAndAlert(deps, now);
  if (capDecision.halt) {
    deps.logger.info('brief-stage work halted by cost cap', {
      ticketId: ticket.id,
    });
    return;
  }

  const body = await resolveIssueBody(deps, ticket);

  const composed = await composeBriefAndRecordUsage(deps, {
    title: ticket.title,
    body,
    now,
  });
  if (composed === undefined) {
    return;
  }

  await postBriefAndPersistPointer(deps, ticket, composed);
}

export function createBriefStageWorkStep(
  deps: BriefStageDeps,
): PullLoopWorkStep {
  return (ticket) => handleBriefStageTicket(deps, ticket);
}

/**
 * BUILD_PLAN 6.1b starvation fix's `needsWork` factory — a `pull-loop.ts`-shaped
 * `(ticket) => Promise<boolean>`, built the same way `createBriefStageWorkStep` above is, alongside
 * it in this file rather than in `create-sarah-pull-loop-behavior-deps.ts` (that file only ever
 * builds the `PullLoopBehaviorDeps` store/client bag; every actual behavior function is a factory
 * called from `resolvePullLoopBehaviors` — spec-grill R1's M1).
 *
 * "Still needs work" means "not yet briefed" for Sarah's Brief stage — reuses the exact same
 * `briefStore.getByTicket` call `handleBriefStageTicket`'s own idempotency check above already
 * makes (a cheap, indexed PK lookup; no new repository function needed). This does mean the
 * eventual winning candidate gets `getByTicket` called twice in one tick (once by the pull loop's
 * own listing-time filter, once here by the work step's idempotency check) — a deliberate,
 * accepted tradeoff (spec-grill R1's L1), not an oversight.
 *
 * Resolves `false` — this function's own resolved return value, never a rejection — on a
 * `briefStore.getByTicket` read failure, the same house Result-pattern every repository function
 * in this codebase already uses (`{ok:false, error}` on failure, never a throw). That means
 * `runPullLoopTick`'s own `.catch(() => true)` fail-open wrapper around each `needsWork` call
 * never fires for this specific check — a transient read failure here instead fails *closed*,
 * excluding the ticket from that one tick's candidates. Deliberately not changed to reject on
 * failure just to make that wrapper fire (spec-grill R2): `needsWork` is re-evaluated fresh every
 * tick, unlike `createdAt`, so this is a bounded, self-healing exclusion window, not a
 * reintroduction of the starvation bug — the ticket becomes eligible again the moment reads start
 * succeeding again.
 */
export function createBriefStageNeedsWorkCheck(
  deps: BriefStageDeps,
): PullLoopNeedsWorkCheck {
  return async (ticket) => {
    const brief = await deps.briefStore.getByTicket(ticket.id);
    return brief.ok && brief.brief === null;
  };
}
