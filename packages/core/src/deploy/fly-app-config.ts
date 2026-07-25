import type { PersonaId } from '../persona-roster.js';

import {
  FLY_CHECK_GRACE_PERIOD,
  FLY_CHECK_INTERVAL,
  FLY_CHECK_METHOD,
  FLY_CHECK_PATH,
  FLY_CHECK_TIMEOUT,
  FLY_INTERNAL_PORT,
  FLY_PRIMARY_REGION,
  FLY_VM_MEMORY,
  FLY_VM_SIZE,
} from './fly-deploy-constants.js';

export type FlyAppConfig = {
  /** The Fly App this persona deploys to — one App per persona, never one App with N process groups. */
  readonly appName: string;
  /** Repo-root-relative, so `fly deploy -c <fileName>` resolves against the default working directory. */
  readonly fileName: string;
  /** Full `fly.<persona>.toml` contents, including the generated-file header. */
  readonly toml: string;
};

/**
 * Builds one persona's complete Fly App configuration (BUILD_PLAN 5.2).
 *
 * **Why one Fly App per persona, rather than one App with eight process groups.** Fly secrets are
 * scoped to an App — "an app's secrets are available as environment variables at runtime on every
 * Machine belonging to that Fly App" (fly.io/docs/apps/secrets/) — and `fly secrets set` has no
 * process-group flag. Fly's multi-process guide states it plainly, though as a convenience of the
 * single-app shape rather than as a limitation: "secrets are shared across all process groups in a
 * single app"
 * (fly.io/docs/app-guides/multiple-processes/ — note that fly.io/docs/launch/processes/ is a
 * *different* page and does not carry this sentence; a review pass read that one and reported the
 * quote as fabricated, so the exact URL is spelled out here). Both verified verbatim against the
 * rendered pages, 2026-07-25. Every persona process reads the same *unsuffixed* `MOE_SLACK_BOT_TOKEN`
 * /`MOE_SLACK_SIGNING_SECRET`/`MOE_SLACK_APP_TOKEN` names (`packages/agents/src/persona-config.ts`),
 * so eight personas need eight independent secret scopes. Sharing one App would mean giving those
 * three variables persona-suffixed names — reversing the explicit decision at BUILD_PLAN 5.1 that
 * `PersonaConfig`/`parsePersonaConfig` stays exactly as chunk 2.2 built it. The App count is this
 * chunk's own call; the *machine* count ("N machines, one per persona") is settled upstream in
 * `docs/decisions/TOPOLOGY-AND-DATABASE.md`, which one App per persona also satisfies.
 *
 * **Why `MOE_PERSONA_ID` sits in `[env]` and the Slack credentials do not.** The persona id is not
 * a secret and is the one value that must differ per deployed config, so it belongs in the config
 * file that is committed. The three Slack credentials are real secrets and are set per App with
 * `fly secrets set -a <appName>` — see `docs/OPERATIONS.md` §Deploying the persona fleet.
 *
 * **Why a top-level `[checks]` block rather than chunk 2.2's `[[http_service.checks]]`.** A persona
 * reaches Slack over Socket Mode, an outbound WebSocket — nothing needs to reach the process from
 * the public internet. `[http_service]` would publish each of the eight Apps on ports 80/443;
 * Fly's configuration reference points at the top-level `[checks]` section for exactly this case
 * ("if your app doesn't have public-facing services... use this top-level `checks` section"). The
 * process still serves `GET /health` on the same internal port, so `createHealthHandler` is
 * unchanged — only its reachability from outside the Fly network is.
 *
 * Chunk 2.2's `auto_stop_machines`/`auto_start_machines`/`min_machines_running` settings are not
 * carried over: all three are `[http_service]`-scoped autostop/autostart controls, and Fly
 * documents `min_machines_running` as having "no effect unless you set `auto_stop_machines` to
 * `"stop"` or `"suspend"`" (fly.io/docs/launch/autostop-autostart/ — verified verbatim there, not
 * on fly.io/docs/reference/configuration/, which states the same rule in different words). It was
 * already a no-op alongside chunk 2.2's own `false`, itself the legacy boolean spelling of the
 * current `"off"`. With no service section at all, a Machine runs until it exits.
 *
 * **Why the deploy command carries `--ha=false`.** Having no services changes what Fly's default
 * `--ha=true` actually does: it "creates and starts one Machine and creates one stopped standby
 * Machine for process groups without services" (fly.io/docs/reference/app-availability/) — a
 * stopped failover that costs nothing until the primary becomes unavailable, *not* a second live
 * process. The flag is still wanted, but for a narrower reason than raw duplication: if Fly ever
 * starts the standby while the primary is merely unreachable rather than dead, two live processes
 * would hold the same persona's Slack connection, and moe has no cross-process reply dedup —
 * `seen-event-cache.ts` is per-process and in-memory. Ticket claims would stay correct (the
 * optimistic-lock claim from BUILD_PLAN 1.3 is concurrency-tested), but Slack replies could
 * double. One Machine per persona is also what `docs/decisions/TOPOLOGY-AND-DATABASE.md` says.
 */
export function buildFlyAppConfig(personaId: PersonaId): FlyAppConfig {
  const appName = `moe-${personaId}`;
  const fileName = `fly.${personaId}.toml`;

  return {
    appName,
    fileName,
    toml: `${buildHeader(personaId, fileName)}
app = "${appName}"
primary_region = "${FLY_PRIMARY_REGION}"

[env]
  PORT = "${FLY_INTERNAL_PORT}"
  MOE_PERSONA_ID = "${personaId}"

[[vm]]
  size = "${FLY_VM_SIZE}"
  memory = "${FLY_VM_MEMORY}"

# No [http_service] on purpose — Socket Mode is outbound-only, so nothing needs a public port.
[checks]
  [checks.health]
    port = ${FLY_INTERNAL_PORT}
    type = "http"
    method = "${FLY_CHECK_METHOD}"
    path = "${FLY_CHECK_PATH}"
    grace_period = "${FLY_CHECK_GRACE_PERIOD}"
    interval = "${FLY_CHECK_INTERVAL}"
    timeout = "${FLY_CHECK_TIMEOUT}"
`,
  };
}

function buildHeader(personaId: PersonaId, fileName: string): string {
  return `# GENERATED FILE — do not hand-edit. Run \`pnpm --filter @moe/core generate:fly-configs\`.
# Source of truth: packages/core/src/deploy/fly-app-config.ts. CI fails if this file is stale.
#
# One Fly App per persona (docs/ARCHITECTURE.md "Process topology"), because Fly secrets are
# App-scoped and every persona process reads the same unsuffixed MOE_SLACK_* variable names.
# The three Slack credentials are set per App: fly secrets set -a moe-${personaId} ...
#
# Deploy (Alex-only, never CI-automated — CLAUDE.md), from the repo root:
#   fly deploy -c ${fileName} --ha=false
# --ha=false is deliberate. This config declares no services, and for a process group without
# services Fly's default --ha=true "creates and starts one Machine and creates one stopped standby
# Machine" — a free failover, not a second live persona. It is turned off because a standby that
# starts while the primary is merely unreachable would put two processes on one persona's Slack
# connection, and moe has no cross-process reply dedup. Expect exactly one Machine; if you ever see
# a second marked with a dagger in \`fly status\`, that is a standby, not a duplicate persona.
# Full runbook: docs/OPERATIONS.md §Deploying the persona fleet.`;
}
