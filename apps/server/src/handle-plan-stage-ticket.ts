import type { CapStore } from './check-cost-cap.js';
import type { Logger } from './logger.js';
import type { PullLoopNeedsWorkCheck, PullLoopWorkStep } from './pull-loop.js';
import type { recordUsageLogged } from './record-usage-logged.js';
import type { composePlan, CostCapConfig, PersonaId, Plan } from '@moe/agents';
import type {
  NewTicketPlan,
  Ticket,
  TicketBrief,
  TicketBriefOrNullResult,
  TicketPlanOrNullResult,
  TicketPlanResult,
} from '@moe/core';
import type { addReaction } from '@moe/slack';

import { TEAM_CHANNEL_ID } from '@moe/core';
import { postMessage } from '@moe/slack';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { composePlanAndRecordUsage } from './compose-plan-and-record-usage.js';

// Re-derived locally the same way `handle-brief-stage-ticket.ts`'s own module-private client
// shapes already are — `PostMessageClient`/`AddReactionClient` are not themselves exported from
// `@moe/slack`'s own `post-message.ts`/`add-reaction.ts`.
type PostMessageClient = Parameters<typeof postMessage>[0];
// Same local re-derivation, for the same reason — only its type is needed here (this work step
// never seeds a reaction itself), so this stays a type-only import.
type AddReactionClient = Parameters<typeof addReaction>[0];
// Derived from `recordUsageLogged`'s own deps type (`RecordUsageDeps`), not
// `checkCostCapAndAlert`'s (`CostCapDeps` has no `costStore` field at all — that field lives on
// `recordUsageLogged`'s deps type instead). Same derivation `handle-brief-stage-ticket.ts` uses.
type CostStore = Parameters<typeof recordUsageLogged>[0]['costStore'];
// Same derivation shape as `handle-brief-stage-ticket.ts`'s own `ComposeBriefClient`.
type ComposePlanClient = Parameters<typeof composePlan>[0];

export type PlanStageDeps = {
  readonly personaId: PersonaId;
  readonly logger: Logger;
  readonly anthropicClient: ComposePlanClient;
  // Widened to satisfy `checkCostCapAndAlert`'s own `CostCapDeps.slackClient`
  // (`PostMessageClient & AddReactionClient`, the same `HandlerDeps.slackClient` shape) even
  // though this work step itself never seeds a reaction — same unused-capability-on-the-type
  // precedent `BriefStageDeps.slackClient` already documents.
  readonly slackClient: PostMessageClient & AddReactionClient;
  readonly costStore: CostStore;
  readonly capStore: CapStore;
  readonly costCapConfig: CostCapConfig;
  readonly planStore: {
    readonly getByTicket: (ticketId: string) => Promise<TicketPlanOrNullResult>;
    readonly create: (input: NewTicketPlan) => Promise<TicketPlanResult>;
  };
  // Read-only — reuses the exact same `getTicketBrief` repository function `BriefStageDeps`
  // doesn't otherwise expose to this file, a separate narrow closure. Returns the *widened*
  // `TicketBrief` (BUILD_PLAN 6.1c's own B1 fix, `packages/core`'s migration `0026`), which
  // carries `summary`/`scope` directly — no separate `Brief`-typed return value is needed here at
  // all. No `githubClient`/`githubRepo`/`issueLinkStore` — not needed: the Brief is the required
  // grounding for a plan, not a fresh GitHub-issue-body fetch (see this chunk's own plan doc for
  // the full reasoning).
  readonly briefStore: {
    readonly getByTicket: (
      ticketId: string,
    ) => Promise<TicketBriefOrNullResult>;
  };
};

// 📐 chosen deliberately distinct from Brief's 📝, echoing Marcus's own "Architect" cast role
// (`docs/PERSONAS.md`/VISION §4.1). Blank-line-joined sections, each conditional block a
// self-contained ternary building its own array (rather than `formatBriefMessageText`'s simpler
// single-conditional-free template) — a plan can genuinely have zero alternatives/zero open
// questions, unlike Brief's own `scope`, which can't be empty and so never needed a conditional at
// all. Built via `[...a, ...b, ...c]` concatenation, not `Array.prototype.push` — this codebase's
// `functional/immutable-data` lint rule disallows mutating array methods regardless of a variable's
// own `const`/readonly declaration.
function formatPlanMessageText(ticketTitle: string, plan: Plan): string {
  const header = [
    `📐 *Plan: ${ticketTitle}*`,
    plan.approach,
    '',
    `*Confidence:* ${plan.confidence}`,
  ];
  const alternatives =
    plan.alternativesConsidered.length > 0
      ? [
          '',
          '*Alternatives considered:*',
          ...plan.alternativesConsidered.map((item) => `• ${item}`),
        ]
      : [];
  const openQuestions =
    plan.openQuestions.length > 0
      ? [
          '',
          '*Open questions:*',
          ...plan.openQuestions.map((item) => `• ${item}`),
        ]
      : [];
  return [...header, ...alternatives, ...openQuestions].join('\n');
}

/**
 * Resolves the required Brief grounding for `composePlanAndRecordUsage` — a ticket in `Plan` is
 * expected to have gone through `Brief` first by construction (once the Brief→Plan transition is
 * real), so a missing/empty brief is a defensive/shouldn't-normally-happen case, not
 * `resolveIssueBody`'s optional-and-falls-back-open shape (`handle-brief-stage-ticket.ts`). A read
 * failure, `brief === null`, **or an empty `summary`** (the legacy/pre-migration-row case the
 * widened `ticketBriefSchema`'s relaxed `.min(1)`-free validation deliberately allows through at
 * the DB layer — that relaxation exists so a *read* doesn't crash on a legacy row, not so this call
 * site treats an empty legacy brief as valid grounding) logs an error and returns `undefined` —
 * `handlePlanStageTicket` returns early in that case, the ticket stays `Plan`, a natural retry
 * candidate next tick (though see `createPlanStageNeedsWorkCheck` below: a *permanently*
 * brief-less ticket won't actually retry productively — it's excluded from candidacy entirely, not
 * infinitely retried).
 */
async function resolveBriefContext(
  deps: PlanStageDeps,
  ticket: Ticket,
): Promise<TicketBrief | undefined> {
  const briefResult = await deps.briefStore.getByTicket(ticket.id);
  if (!briefResult.ok) {
    deps.logger.error('failed to look up brief for plan grounding', {
      ticketId: ticket.id,
    });
    return undefined;
  }
  const brief = briefResult.brief;
  if (brief === null || brief.summary === '') {
    deps.logger.error('ticket has no usable brief to ground a plan in', {
      ticketId: ticket.id,
    });
    return undefined;
  }
  return brief;
}

/**
 * Posts the composed plan to `#moe-team` and persists the `ticket_plans` pointer on success —
 * mirrors `postBriefAndPersistPointer` exactly (`handle-brief-stage-ticket.ts`). A post failure
 * logs and returns without persisting (nothing was written, so the idempotency check won't block a
 * retry next tick); a persist failure after a successful post logs but does not throw — see
 * `ticket-plan.ts`'s own TSDoc for the accepted residual-risk case this leaves.
 */
async function postPlanAndPersistPointer(
  deps: PlanStageDeps,
  ticket: Ticket,
  composed: Plan,
): Promise<void> {
  const posted = await postMessage(deps.slackClient, {
    channelId: TEAM_CHANNEL_ID,
    text: formatPlanMessageText(ticket.title, composed),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post plan to slack', {
      ticketId: ticket.id,
      errorMessage: posted.error.message,
    });
    return;
  }

  const created = await deps.planStore.create({
    ticketId: ticket.id,
    channelId: TEAM_CHANNEL_ID,
    messageTs: posted.ts,
  });
  if (!created.ok) {
    deps.logger.error('failed to persist plan pointer after posting', {
      ticketId: ticket.id,
      channelId: TEAM_CHANNEL_ID,
      messageTs: posted.ts,
    });
  }
}

/**
 * BUILD_PLAN 6.1c's Plan-stage work step — composes an LLM plan for a ticket claimed out of
 * `Plan`, grounded in its already-composed Brief, posts it to `#moe-team`, and persists a pointer
 * so a later chunk can find the message and drive a reaction-triggered `Plan`→`Build` transition
 * (out of scope here — see this chunk's own plan doc's scope note).
 *
 * **Idempotency-first, same hard requirement as Brief's own handler:** checks `planStore.getByTicket`
 * FIRST, before any brief lookup, LLM call, cost-cap read, or Slack call — a pointer already
 * existing means Marcus has already planned this ticket, so this returns immediately rather than
 * spamming a duplicate post every tick forever. A failed idempotency read itself also returns
 * early (fails closed here, unlike the cost-cap reads below) — better to skip a tick and retry than
 * risk a duplicate post if the read's `ok:false` masked a real already-planned row.
 *
 * **Ordering deliberately departs from Brief's own sequence:** `resolveBriefContext` (required;
 * returns early on `undefined`) runs BEFORE the cost-cap check, not after. Brief's own order runs
 * cost-cap before its own (optional, never-bailing) `resolveIssueBody`, which is fine there since
 * that call never aborts the tick. `resolveBriefContext` is a hard bail, and `checkCostCapAndAlert`
 * does two DB reads and can claim an alert threshold / send a Slack DM (real side effects, not
 * free) — running it before confirming grounding actually exists would waste that work (and a
 * claimed alert-threshold slot) on a tick that's going to discover there's no brief and bail with
 * zero LLM work attempted. Cheapest-first ordering, applied consistently, puts the free-er
 * precondition check first here.
 */
export async function handlePlanStageTicket(
  deps: PlanStageDeps,
  ticket: Ticket,
): Promise<void> {
  const existing = await deps.planStore.getByTicket(ticket.id);
  if (!existing.ok) {
    deps.logger.error('failed to check for an existing plan', {
      ticketId: ticket.id,
    });
    return;
  }
  if (existing.plan !== null) {
    deps.logger.info('ticket already planned, skipping', {
      ticketId: ticket.id,
    });
    return;
  }

  const brief = await resolveBriefContext(deps, ticket);
  if (brief === undefined) {
    return;
  }

  const now = new Date();
  const capDecision = await checkCostCapAndAlert(deps, now);
  if (capDecision.halt) {
    deps.logger.info('plan-stage work halted by cost cap', {
      ticketId: ticket.id,
    });
    return;
  }

  const composed = await composePlanAndRecordUsage(deps, {
    title: ticket.title,
    briefSummary: brief.summary,
    briefScope: brief.scope,
    now,
  });
  if (composed === undefined) {
    return;
  }

  await postPlanAndPersistPointer(deps, ticket, composed);
}

export function createPlanStageWorkStep(deps: PlanStageDeps): PullLoopWorkStep {
  return (ticket) => handlePlanStageTicket(deps, ticket);
}

/**
 * BUILD_PLAN 6.1c's `needsWork` factory for Marcus's Plan stage — NOT a bare mirror of
 * `createBriefStageNeedsWorkCheck`. Brief's own `needsWork` only has to ask "not yet briefed"
 * because *every* Brief-stage candidate is eventually briefable (`resolveIssueBody` always falls
 * back, never bails). Marcus's grounding is a hard precondition — a Plan-stage ticket that will
 * *never* get a brief (a data-integrity gap, not a transient failure) would otherwise report
 * `needsWork: true` forever with an unchanging `createdAt`, reproducing the exact starvation shape
 * BUILD_PLAN 6.1b's own starvation bug had: it could perpetually out-select a genuinely plannable,
 * newer ticket under `findNextClaimableTicket`'s oldest-first ordering. Requiring `brief !== null
 * && summary !== ''` before reporting `needsWork: true` closes that.
 *
 * **Accepted residual gap, named rather than solved here:** a ticket that's excluded this way
 * (genuinely brief-less) becomes invisible to the pull loop entirely — never processed, no
 * starvation, but also no surfaced signal beyond `resolveBriefContext`'s own error log.
 * Diagnosing/alerting on a stuck-for-a-missing-precondition ticket is a different problem than
 * BUILD_PLAN 6.6's stale-*claim* reaper (this ticket is never claimed at all) and is out of scope
 * here — same "name the accepted gap rather than silently ship it" discipline `ticket-brief.ts`'s
 * own TSDoc already uses for its orphaned-claim case.
 */
export function createPlanStageNeedsWorkCheck(
  deps: PlanStageDeps,
): PullLoopNeedsWorkCheck {
  return async (ticket) => {
    const plan = await deps.planStore.getByTicket(ticket.id);
    if (!plan.ok || plan.plan !== null) return false;
    const brief = await deps.briefStore.getByTicket(ticket.id);
    return brief.ok && brief.brief !== null && brief.brief.summary !== '';
  };
}
