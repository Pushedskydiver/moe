import type { Logger } from './logger.js';
import type { PersonaId } from '@moe/core';
import type {
  ManifestClient,
  ProvisionPersonaSlackAppResult,
} from '@moe/slack';

import { PERSONA_ROSTER } from '@moe/core';
import { provisionPersonaSlackApp } from '@moe/slack';

export type ProvisionSlackAppsDeps = {
  readonly logger: Logger;
  readonly manifestClient: ManifestClient;
  readonly personaIds: readonly PersonaId[];
  // Injectable wait so tests don't actually sleep — production passes a real setTimeout-backed
  // delay. `apps.manifest.create` is Tier 1 (~1/min, verified live 2026-07-24), the scarcest
  // budget in this whole flow; `validate` (Tier 3, ~50/min) needs no throttling of its own.
  readonly waitMs: (ms: number) => Promise<void>;
};

const CREATE_RATE_LIMIT_WAIT_MS = 60_000;

/**
 * One persona's own outcome, printed to stdout at the end of the run (Alex confirmed via
 * `AskUserQuestion`, BUILD_PLAN 5.1: print + manual copy into `.env.local`/Fly secrets, matching
 * today's precedent for Sarah's own hand-populated credentials — no new secrets-at-rest surface).
 */
function printOutcome(
  logger: Logger,
  personaId: PersonaId,
  result: ProvisionPersonaSlackAppResult,
): void {
  if (!result.ok) {
    logger.error('failed to provision persona Slack app', {
      personaId,
      errorKind: result.error.kind,
      errorMessage: result.error.message,
    });
    return;
  }

  const { displayName } = PERSONA_ROSTER[personaId];
  // Deliberately not logged via `logger` (which may reach structured/aggregated log storage) —
  // this is printed once, directly, for Alex to copy from his own terminal, same posture as the
  // rest of this codebase's "never let a captured secret land anywhere but its intended
  // destination" discipline.
  console.log(
    [
      `--- ${displayName} (${personaId}) ---`,
      `app_id: ${result.app.appId}`,
      `client_id: ${result.app.clientId}`,
      `signing_secret: ${result.app.signingSecret}`,
      `oauth_authorize_url: ${result.app.oauthAuthorizeUrl}`,
      '',
    ].join('\n'),
  );
}

// A `validation-failed` result never reached `create` — Tier 3 (~50/min), no rate-limit wait
// owed to the next persona. Every other outcome (success, or a `creation-failed`/
// `incomplete-response` failure) did spend a real `create` call against the Tier-1 (~1/min)
// budget, so the next persona still needs the full wait.
function consumedCreateBudget(result: ProvisionPersonaSlackAppResult): boolean {
  return result.ok || result.error.kind !== 'validation-failed';
}

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section), matching
// `create-issues-for-tickets.ts`'s own sequential-by-design precedent. One persona's failure logs
// and moves on to the next rather than aborting the whole run — but a partial batch (e.g. 4 of 7
// apps created before a rate-limit or network error) is NOT safely re-runnable by just re-running
// the same full list: `apps.manifest.create` has no natural-key dedup, so retrying an
// already-succeeded persona creates a second, duplicate app (DA review's own MATERIAL finding on
// this file's earlier, incorrect claim otherwise). Recovering from a partial failure means the
// caller passes a narrower `personaIds` list on retry — `scripts/provision-slack-apps.ts`'s own
// `MOE_SLACK_PROVISION_PERSONA_IDS` override exists for exactly this.
async function provisionRemaining(
  deps: ProvisionSlackAppsDeps,
  personaIds: readonly PersonaId[],
  shouldWait: boolean,
): Promise<void> {
  const [personaId, ...rest] = personaIds;
  if (personaId === undefined) return;

  if (shouldWait) {
    await deps.waitMs(CREATE_RATE_LIMIT_WAIT_MS);
  }

  const result = await provisionPersonaSlackApp(deps.manifestClient, personaId);
  printOutcome(deps.logger, personaId, result);

  await provisionRemaining(deps, rest, consumedCreateBudget(result));
}

/**
 * BUILD_PLAN 5.1's own provisioning run — one manifest template looped over the persona configs,
 * each real Slack app created via `apps.manifest.validate` → `create`. Manually triggered (same
 * no-scheduled-job-infrastructure precedent every other admin script in this repo already
 * establishes) since it's a one-shot, Alex-run action, not a standing service. Deliberately
 * doesn't attempt Sarah — she already has a real, live app (`docs/VISION.md` §4.1); the caller
 * decides which persona ids need provisioning, this function doesn't hardcode an exclusion.
 */
export async function provisionSlackApps(
  deps: ProvisionSlackAppsDeps,
): Promise<void> {
  await provisionRemaining(deps, deps.personaIds, false);
  deps.logger.info('slack app provisioning run complete', {
    personaCount: deps.personaIds.length,
  });
}
