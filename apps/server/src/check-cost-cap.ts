import type { HandlerDeps } from './handle-inbound-message.js';
import type { PersonaId } from '@moe/agents';
import type {
  AlertClaimResult,
  PersonaCostAlertOrNullResult,
  PersonaCostMonthlyTotalResult,
} from '@moe/core';

import { evaluateCostCap } from '@moe/agents';
import { toUtcMonth } from '@moe/core';
import { postMessage } from '@moe/slack';

import { repositoryErrorMessage } from './repository-error.js';

type CostCapScope = {
  readonly personaId: string;
  readonly month: string;
};

// Thin, directly-mockable DI seam over `@moe/core`'s cost-cap repository (BUILD_PLAN 2.6b), same
// style as `handle-inbound-message.ts`'s `HistoryStore`/`CostStore` — real binding lives in
// `start-slack-listener.ts`.
export type CapStore = {
  readonly getMonthlyCost: (
    scope: CostCapScope,
  ) => Promise<PersonaCostMonthlyTotalResult>;
  readonly getAlertState: (
    scope: CostCapScope,
  ) => Promise<PersonaCostAlertOrNullResult>;
  readonly claimAlertThreshold: (input: {
    readonly personaId: string;
    readonly month: string;
    readonly threshold: number;
  }) => Promise<AlertClaimResult>;
};

// This module only ever touches 5 of `HandlerDeps`'s fields — `Pick` rather than the full type,
// so a caller (or a future test) only needs to supply what's actually used here, not every field
// `handle-inbound-message.ts` itself needs. Still a type-only reference to `HandlerDeps`, so it
// erases at compile time regardless of the type-only import cycle that creates with
// `handle-inbound-message.ts` importing `CapStore` back from this file.
type CostCapDeps = Pick<
  HandlerDeps,
  'capStore' | 'costCapConfig' | 'personaId' | 'slackClient' | 'logger'
>;

/**
 * DM'd to `costCapConfig.alertSlackUserId` (Alex) on a newly-crossed spend-alert rung — a
 * separate audience from `handle-inbound-message.ts`'s `HALT_TEXT`, which is user-facing in the
 * original channel. Dollar amounts are formatted from the same integer micro-USD values
 * `evaluateCostCap` already compared exactly — the division to dollars here is display-only,
 * never fed back into a threshold decision.
 */
function costAlertText(input: {
  readonly personaId: PersonaId;
  readonly threshold: number;
  readonly monthlyCostUsdMicros: number;
  readonly capUsdMicros: number;
}): string {
  const spent = (input.monthlyCostUsdMicros / 1_000_000).toFixed(2);
  const cap = (input.capUsdMicros / 1_000_000).toFixed(2);
  return `${input.personaId} has crossed ${input.threshold}% of its monthly cost cap: $${spent} of $${cap} spent this month.`;
}

/**
 * Recursive, not a `for` loop — matches `@moe/core`'s `migrate.ts` `applyPending` precedent for
 * sequential-by-design async work over a short list (at most 3 thresholds). Claims one threshold
 * at a time, in ascending order, via `capStore.claimAlertThreshold`'s atomic conditional update
 * (`@moe/core`'s `claimAlertThreshold`, same `WHERE`-guarded mechanism as
 * `ticket-lifecycle/claim.ts`'s `claimTicket`) — the DM is only sent when the claim actually wins,
 * so two concurrent turns for the same persona (`apps/server`'s own `threadQueue` only serializes
 * per-thread, not process-wide) evaluating the same newly-crossed threshold can never both send
 * the same DM: exactly one claim can win, `{ kind: 'unavailable' }` for the loser is expected,
 * quiet behavior, not an error. If the claim wins but the Slack post itself then fails, the
 * watermark still advances (the claim already committed) — this rung's alert is not retried this
 * month. That's a narrower, rarer gap than the alternative (post-before-claim), which would let
 * concurrent callers each observe success and each send a duplicate — VISION §10's own
 * "alerts once, not every turn after" is a harder requirement to violate than "never once misses an
 * alert during a Slack outage," so this chunk accepts the latter, narrower risk.
 */
async function sendCostAlerts(
  deps: CostCapDeps,
  input: {
    readonly scope: CostCapScope;
    readonly thresholds: readonly number[];
    readonly monthlyCostUsdMicros: number;
  },
): Promise<void> {
  const [threshold, ...rest] = input.thresholds;
  if (threshold === undefined) return;

  const claimed = await deps.capStore.claimAlertThreshold({
    ...input.scope,
    threshold,
  });
  if (claimed.ok) {
    const posted = await postMessage(deps.slackClient, {
      channelId: deps.costCapConfig.alertSlackUserId,
      text: costAlertText({
        personaId: deps.personaId,
        threshold,
        monthlyCostUsdMicros: input.monthlyCostUsdMicros,
        capUsdMicros: deps.costCapConfig.monthlyCapUsdMicros,
      }),
    });
    if (!posted.ok) {
      deps.logger.error('failed to post cost cap alert', {
        message: posted.error.message,
      });
    }
  } else if (claimed.error.kind !== 'unavailable') {
    deps.logger.error('failed to record cost alert threshold', {
      message: repositoryErrorMessage(claimed.error),
    });
  }

  await sendCostAlerts(deps, { ...input, thresholds: rest });
}

/**
 * Checks a persona's current-month spend against its configured cap (BUILD_PLAN 2.6b) before a
 * turn generates a reply — `handle-inbound-message.ts`'s `generateAndPost` skips `generateReply`
 * entirely when `halt` comes back `true`, so a halted turn never reaches the Anthropic API at
 * all, not just its reply being discarded afterward. Any newly-crossed alert rung
 * (`evaluateCostCap`, `@moe/agents`) goes through `sendCostAlerts`'s own atomic claim-then-alert
 * step — see its TSDoc for what "newly-crossed" actually guarantees under concurrent turns. A read
 * failure on either the monthly total or the alert-dedup state fails open (`halt: false`) — same
 * "log, don't block replies" posture every other infra-failure path in this app already takes.
 * `halt` is never cached — it's recomputed from a live DB read on every single turn, so both
 * fail-open and a hypothetical fail-closed self-heal at the identical per-turn granularity the
 * moment the DB recovers; "self-heals sooner" isn't the actual trade-off. The real one: fail-open
 * risks unbounded spend for an outage's duration; fail-closed would block every reply for that
 * persona over the same window, and — since a DB blip is unrelated to actual spend — do it with a
 * `HALT_TEXT` message that misleadingly claims a budget cap was hit. With no escalation/paging
 * path yet to surface a sustained outage independently, and moe still a single-early-adopter
 * deployment, a bounded window of unchecked spend is judged the smaller cost of the two; revisit
 * if usage volume or team size changes that calculus.
 */
export async function checkCostCapAndAlert(
  deps: CostCapDeps,
  now: Date,
): Promise<{ readonly halt: boolean }> {
  const scope: CostCapScope = {
    personaId: deps.personaId,
    month: toUtcMonth(now.toISOString()),
  };

  const totalResult = await deps.capStore.getMonthlyCost(scope);
  if (!totalResult.ok) {
    deps.logger.error('failed to fetch monthly cost total', {
      message: repositoryErrorMessage(totalResult.error),
    });
    return { halt: false };
  }

  const alertStateResult = await deps.capStore.getAlertState(scope);
  if (!alertStateResult.ok) {
    deps.logger.error('failed to fetch cost alert state', {
      message: repositoryErrorMessage(alertStateResult.error),
    });
    return { halt: false };
  }

  const evaluation = evaluateCostCap({
    monthlyCostUsdMicros: totalResult.total.costUsdMicros,
    capUsdMicros: deps.costCapConfig.monthlyCapUsdMicros,
    highestThresholdAlerted:
      alertStateResult.alert?.highestThresholdAlerted ?? 0,
  });

  await sendCostAlerts(deps, {
    scope,
    thresholds: evaluation.newlyCrossedThresholds,
    monthlyCostUsdMicros: totalResult.total.costUsdMicros,
  });

  return { halt: evaluation.halt };
}
