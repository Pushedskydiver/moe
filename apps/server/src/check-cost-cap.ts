import type { HandlerDeps } from './handle-inbound-message.js';
import type {
  PersonaCostAlertOrNullResult,
  PersonaCostAlertResult,
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
  readonly recordAlertThreshold: (input: {
    readonly personaId: string;
    readonly month: string;
    readonly threshold: number;
  }) => Promise<PersonaCostAlertResult>;
};

/**
 * DM'd to `costCapConfig.alertSlackUserId` (Alex) on a newly-crossed spend-alert rung — a
 * separate audience from `handle-inbound-message.ts`'s `HALT_TEXT`, which is user-facing in the
 * original channel. Dollar amounts are formatted from the same integer micro-USD values
 * `evaluateCostCap` already compared exactly — the division to dollars here is display-only,
 * never fed back into a threshold decision.
 */
function costAlertText(input: {
  readonly personaId: string;
  readonly threshold: number;
  readonly monthlyCostUsdMicros: number;
  readonly capUsdMicros: number;
}): string {
  const spent = (input.monthlyCostUsdMicros / 1_000_000).toFixed(2);
  const cap = (input.capUsdMicros / 1_000_000).toFixed(2);
  return `${input.personaId} has crossed ${input.threshold}% of its monthly cost cap: $${spent} of $${cap} spent this month.`;
}

// Recursive, not a `for` loop — matches `@moe/core`'s `migrate.ts` `applyPending` precedent for
// sequential-by-design async work over a short list (at most 3 thresholds). Sends and records one
// at a time, in ascending order, so a partial failure mid-list still leaves earlier rungs alerted
// and persisted.
async function sendCostAlerts(
  deps: HandlerDeps,
  input: {
    readonly scope: CostCapScope;
    readonly thresholds: readonly number[];
    readonly monthlyCostUsdMicros: number;
  },
): Promise<void> {
  const [threshold, ...rest] = input.thresholds;
  if (threshold === undefined) return;

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

  const recorded = await deps.capStore.recordAlertThreshold({
    ...input.scope,
    threshold,
  });
  if (!recorded.ok) {
    deps.logger.error('failed to record cost alert threshold', {
      message: repositoryErrorMessage(recorded.error),
    });
  }

  await sendCostAlerts(deps, { ...input, thresholds: rest });
}

/**
 * Checks a persona's current-month spend against its configured cap (BUILD_PLAN 2.6b) before a
 * turn generates a reply — `handle-inbound-message.ts`'s `generateAndPost` skips `generateReply`
 * entirely when `halt` comes back `true`, so a halted turn never reaches the Anthropic API at
 * all, not just its reply being discarded afterward. Any newly-crossed alert rung
 * (`evaluateCostCap`, `@moe/agents`) is DM'd to Alex and its watermark persisted before
 * returning, so a crash between the two would at worst re-send one alert next turn, never
 * silently drop it. A read failure on either the monthly total or the alert-dedup state fails
 * open (`halt: false`) — same "log, don't block replies" posture every other infra-failure path
 * in this app already takes; a transient DB error blocking every future reply for the rest of the
 * month would be a far worse outcome than one unchecked turn.
 */
export async function checkCostCapAndAlert(
  deps: HandlerDeps,
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
