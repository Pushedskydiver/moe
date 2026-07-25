# Operations

Manual operational runbooks for moe in production — how to deploy the persona fleet, how to
restore the database, and when to use which restore path. `docs/DEVELOPMENT.md` covers day-to-day
dev workflow; this doc covers production. The restore half was built at BUILD_PLAN chunk 4.6, the
chunk that closes Stage 4 —
`docs/decisions/TOPOLOGY-AND-DATABASE.md` chose Neon Postgres for production but explicitly left
its PITR/branching retention specifics "not independently vetted in depth" and flagged this chunk
to verify them before relying on it. That verification, and a live rehearsal of both restore paths
below, happened directly against the real Neon project ("Moe AI Team",
`plain-wildflower-25588697`) before this doc was written.

No automation or scheduling exists for any of it — every runbook here is manually triggered,
matching every other operational script in this repo (`migrate.ts`, the review-queue sweep,
`create:github-issues`). A scheduled/unattended backup job is future work once real production
traffic and a scheduler exist; building one now would be inventing infrastructure ahead of need.

---

## Deploying the persona fleet

Built at BUILD_PLAN chunk 5.2. Each of the eight roster personas is its own Fly App, `moe-sarah`
through `moe-maya`, all running the same image from the same `Dockerfile` and differing only in
their `[env] MOE_PERSONA_ID` and their own three Slack secrets. **One Fly App per persona is
forced, not stylistic:** Fly secrets are App-scoped, `fly secrets set` has no process-group flag,
and every persona process reads the same unsuffixed `MOE_SLACK_BOT_TOKEN`/`MOE_SLACK_SIGNING_SECRET`
/`MOE_SLACK_APP_TOKEN` names — so one App with eight process groups could not give them different
values. `docs/decisions/TOPOLOGY-AND-DATABASE.md` settles the _machine_ count ("N machines, one
per persona"), which this shape also satisfies.

The eight `fly.<persona>.toml` files at the repo root are **generated** from
`packages/core/src/deploy/fly-app-config.ts` — never hand-edit them. Run
`pnpm --filter @moe/core generate:fly-configs` after changing the builder or the roster; CI's
"Fly configs freshness" job fails the build if the committed files drift.

**Deploys are Alex-only and never CI-automated** (`CLAUDE.md`, `docs/GIT.md` §Deploy Flow) — a
truncated/empty secret has taken the live service down before, and that risk now multiplies across
eight Apps on a manual copy-paste path.

### First-time setup, once per persona

**Prerequisite for every persona except Sarah: the Slack app has to exist first.** Only Sarah has
a real Slack app today. The other seven need `pnpm --filter @moe/server provision:slack-apps` to
actually run against Slack — BUILD_PLAN 5.1 built and tested that script but never executed it
live — which itself needs a fresh 12-hour `MOE_SLACK_APP_CONFIG_TOKEN` from api.slack.com/apps,
plus the `apps.manifest.export` cross-check against Sarah's real app that
`packages/slack/src/build-persona-slack-manifest.ts`'s own TSDoc sets as a hard gate. Without that,
there are no `MOE_SLACK_*` credentials to set below and the Machine will crash-loop on boot.

```bash
fly auth login                                    # once per machine
fly apps create moe-sarah                         # `fly deploy` will not create a missing App
fly secrets set -a moe-sarah --stage \
  MOE_SLACK_BOT_TOKEN=xoxb-... \
  MOE_SLACK_SIGNING_SECRET=... \
  MOE_SLACK_APP_TOKEN=xapp-... \
  ANTHROPIC_API_KEY=sk-ant-... \
  DATABASE_URL="postgres://...-pooler.../..." \
  MOE_COST_CAP_MONTHLY=50 \
  MOE_COST_ALERT_SLACK_USER_ID=U... \
  MOE_WORK_RELEVANT_CHANNEL_IDS=C...,C... \
  MOE_GITHUB_APP_ID=... \
  MOE_GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----" \
  MOE_GITHUB_INSTALLATION_ID=... \
  MOE_GITHUB_REPO=owner/name
```

- `--stage` writes the secrets to the App's vault **without** triggering a Machine update. Without
  it, each `fly secrets set` deploys immediately — the staged form means the first real deploy
  below picks them all up in one go instead of rolling the Machine once per invocation.
- `MOE_PERSONA_ID` is deliberately **not** a secret: it isn't sensitive, and it's the one value
  that must differ per config file, so it lives in the generated `[env]` block instead.
- Every variable in the block above is **required** — `parseBootConfig` validates all six config
  groups and exits on the first invalid one, so a missing `MOE_COST_CAP_MONTHLY` or
  `MOE_WORK_RELEVANT_CHANNEL_IDS` stops the process booting rather than falling back to a default.
  The two variables _not_ in that block both come from the generated `[env]`: `MOE_PERSONA_ID`
  (required, and the whole point of the per-persona config) and `PORT` (the only variable anywhere
  with a real default — `resolvePort` falls back to 8080 — though the config sets it explicitly).
- `MOE_COST_CAP_MONTHLY` is not sensitive, but it lives with the secrets rather than in the
  generated config so a cap can be re-tuned per persona without regenerating configs or rebuilding
  the image. It still costs a Machine restart, like any `fly secrets set` without `--stage`.
- `MOE_SLACK_APP_CONFIG_TOKEN` is **not** part of a deploy — it's the short-lived provisioning
  credential for `pnpm --filter @moe/server provision:slack-apps` only, and expires in 12 hours.
- **`DATABASE_URL` must be Neon's _pooled_ (`-pooler`) hostname — for the persona processes.** This
  rule is about the always-on runtime pools only; it is _not_ repo-wide, and the exceptions are
  below under "Which endpoint for which job". There are two separate budgets
  here. Against the **direct** endpoint, a 0.25 CU compute allows 104 connections with 7 reserved
  for the Neon superuser, so 97 are usable — and the fleet's eight pools at `max: 5` each
  (`packages/core/src/ticket-lifecycle/db.ts`) come to 40 of those, leaving headroom for a rolling
  restart that briefly holds an old and a new pool open at once. Against the **pooled** endpoint
  the ceiling is 10,000 client connections, so the fleet is nowhere near it. The direct hostname
  therefore works today and is still a trap: it leaves far less margin, and it degrades under
  exactly the conditions you least want it to.

### Which endpoint for which job

Neon's pooled endpoint runs PgBouncer in transaction mode, which does not support `SET`/`RESET`,
`LISTEN`/`NOTIFY`, SQL-level `PREPARE`/`DEALLOCATE`, `WITH HOLD` cursors, `LOAD`, temporary tables,
or **session-level advisory locks**. That last one is what makes the migration exception below
checkable from this list rather than taken on trust: Neon's restriction names _session_-level
advisory locks specifically, and `migrate.ts` takes a _transaction_-scoped one. Neon's own guidance is to
"use a direct connection for schema migrations, pg_dump, logical replication, and queries that
depend on `SET`, `LISTEN`/`NOTIFY`, or session-level state."

| Job                                          | Endpoint                | Why                                                                              |
| -------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Persona processes (`fly secrets set`)        | **pooled**              | Eight always-on pools against one compute; see the connection budget above       |
| `pnpm --filter @moe/core migrate`            | **pooled** is safe here | See the caveat below — this is a moe-specific exception to Neon's general advice |
| `pnpm --filter @moe/core backup` / `restore` | **direct**              | `pg_dump`/`pg_restore` emit `SET` statements, which transaction pooling rejects  |

**The migration exception, and when it stops holding.** Neon lists schema migrations as "direct"
because "tools may not support transaction pooling" — a statement about tools in general. moe's own
`migrate.ts` was built for the pooled endpoint deliberately: it takes `pg_advisory_xact_lock`, a
_transaction_-scoped lock rather than a session-scoped one, which is exactly the unit transaction
pooling preserves. Verified for this repo (re-run at BUILD_PLAN 3.7, which added `0017` and `0018` — both plain
transactional `ALTER TABLE`s): none of the 18 migration files uses `SET`, `RESET`,
`CREATE INDEX CONCURRENTLY`, `LISTEN`, SQL-level `PREPARE`, or a temporary table. **The first
migration that needs any of those must run against the direct endpoint instead** — `CREATE INDEX
CONCURRENTLY` is the likely first offender, since it also cannot run inside the transaction
`migrate.ts` wraps each batch in.

### Deploying

Migrations first, once — every persona shares one database, so this is not per-App:

```bash
# Pooled or direct both work here — see "Which endpoint for which job" above for why moe's
# migrations are safe on the pooled endpoint when Neon's general advice says direct.
DATABASE_URL="<production-connection-string>" pnpm --filter @moe/core migrate
```

Then, per persona, from the repo root:

```bash
fly deploy -c fly.sarah.toml --ha=false
```

- **`--ha=false` is deliberate.** `fly deploy` defaults `--ha` to **true**. Because these configs
  declare no services, that default "creates and starts one Machine and creates one stopped standby
  Machine" — a failover that costs nothing until the primary becomes unavailable, **not** a second
  live persona. It's turned off anyway because if Fly ever starts the standby while the primary is
  merely unreachable rather than dead, two processes would hold one persona's Slack connection, and
  moe has no cross-process reply dedup (`seen-event-cache.ts` is per-process, in-memory). Ticket
  claims would stay correct — the optimistic-lock claim is concurrency-tested — but Slack replies
  could double. `docs/decisions/TOPOLOGY-AND-DATABASE.md`'s "one machine per persona" agrees.
- `-c` resolves against `fly deploy`'s working-directory argument, which defaults to the current
  directory — so run this from the repo root, where both the config and the `Dockerfile` live.
- To avoid eight redundant image builds, build once and reuse:
  `fly deploy -c fly.sarah.toml --build-only --push` prints a `registry.fly.io/...:deployment-xxxx`
  tag, and `fly deploy -c fly.<persona>.toml --image <tag> --ha=false` deploys that exact image to
  each App. The `-c` on the build step is **required**, not decorative: `fly deploy` resolves an app
  name before it builds anything, and since 5.2 deleted the root `fly.toml` there is no config for a
  bare invocation to fall back on — it aborts asking for an app name instead of building (paraphrased;
  the exact flyctl wording hasn't been reproduced here, since this environment has no Fly org).
  Cross-App pulls of one App's registry tag work within a single Fly organization — **verified on
  the first real fleet deploy, 2026-07-25**: all seven remaining personas deployed from one
  `registry.fly.io/moe-marcus:deployment-...` tag built once with `--build-only --push`, and every
  one came up healthy. If it ever fails, fall back to a plain per-App `fly deploy -c ... --ha=false`.

### Verifying

There is no public URL to curl: the generated configs have no `[http_service]` section, so nothing
is published on ports 80/443 (personas reach Slack over Socket Mode, an outbound WebSocket — no
inbound HTTP is needed, and eight public endpoints would be attack surface for nothing). The
health check runs on Fly's private network against `GET /health` on port 8080.

```bash
fly checks list -a moe-sarah      # the health check's own pass/fail
fly logs -a moe-sarah             # structured boot logs, secrets redacted
fly status -a moe-sarah           # expect exactly ONE Machine (see note below)
```

If `fly status` ever shows a second Machine marked with a `†`, that is a **standby** — a stopped
failover, not a duplicate persona running twice. Fly creates one when `--ha` is left at its default,
but only at specific moments: a first deploy, a redeploy after scaling to zero Machines, or when a
new process group appears — not on every ordinary redeploy. So seeing one means a deploy at one of
those moments omitted the flag. Destroy it with `fly machine destroy <id>` and redeploy with
`--ha=false`, rather than assuming the fleet is double-running.

A `GET /health` body is `{"status":"ok","personaId":"<persona>"}` — the `personaId` is what makes
it a per-persona signal rather than a generic liveness ping. To reach it directly,
`fly ssh console -a moe-sarah -C "wget -qO- localhost:8080/health"`.

---

## Path 1 (primary): Neon point-in-time restore

Neon retains a window of write-ahead log history per branch and can rewind a branch to any
timestamp or LSN within that window. This is the first restore path to reach for — no app code
involved, works from the Neon console, CLI, or API.

**When to use it:** ordinary data-loss/corruption recovery, day-to-day accidental deletes, or the
first thing to try in most incident scenarios.

**Retention window** (verified against Neon's current pricing/docs, 2026-07-24 — re-check before
relying on a specific window, these are plan-tier limits that could change):

| Plan   | Default | Extendable to | Cost beyond default                 |
| ------ | ------- | ------------- | ----------------------------------- |
| Free   | 6 hours | — (1 GB cap)  | n/a — hard cap, no paid extension   |
| Launch | 1 day   | up to 7 days  | $0.20/GB-month retained WAL storage |
| Scale  | 1 day   | up to 30 days | $0.20/GB-month retained WAL storage |

A meaningful recovery window (multi-day) requires a paid plan, not just the base subscription.

**How restore actually works:** mechanically a branch swap, not an in-place rewind. Neon builds a
new branch at the target timestamp/LSN, then moves the original branch's compute onto it and
renames it to the original branch's name — the connection string stays stable, but the old
pre-restore state isn't destroyed: it's preserved as a separate branch under whatever name
`--preserve-under-name` specifies.

**CLI syntax** (scriptable — not console-only). Neon's current docs invoke the CLI as `neon`;
`neonctl` is a working alias (the Homebrew formula's own name, still fully functional — this is
what the rehearsal below actually ran):

```bash
neon branches restore <branch-name-or-id> "^self@<ISO-8601-timestamp-millisecond-precision>" \
  --project-id <project-id> \
  --preserve-under-name <name-for-the-preserved-pre-restore-branch>
```

- The timestamp must be millisecond precision (`2026-07-24T02:38:48.565Z`) — microsecond-precision
  timestamps (what Postgres's own `now()` returns) are rejected and must be truncated first.
- `^self@<timestamp>` restores the branch to a point in its _own_ history. `^parent` restores to
  the head of its parent branch instead; a specific branch ID/name restores to _that_ branch's
  head. See `neon branches restore --help` for the full source-format grammar.
- The restore is asynchronous — poll `neon branches get <branch-id> --project-id <project-id>`
  until `current_state` reads `ready` before assuming it's done.
- Requires a Neon **API key** (Account Settings → API Keys in the console) exported as
  `NEON_API_KEY`, or passed via `--api-key` — this is a control-plane credential, distinct from the
  database connection string, and authenticates the CLI non-interactively.
- Delete the preserved pre-restore branch once you've confirmed the restore is correct — it's not
  needed after that, and leaving throwaway branches around is just clutter.

**Known operational risk:** Neon's own status page shows a recurring pattern of branch/compute
reliability incidents through 2026 (stuck operations, elevated API latency, branch-creation
failures — roughly monthly). None are data-loss bugs, but since this restore path depends on
branch-create/compute-start operations succeeding, a Neon-side incident at exactly the wrong moment
could delay a restore. This is the reason Path 2 exists as a genuine fallback, not just a
formality — mirrors why the original topology ADR hedged against Litestream's own bug history
rather than trusting a single mechanism.

---

## Path 2 (fallback): pg_dump / pg_restore

A traditional logical backup/restore, independent of Neon's own control plane. Neon's own docs
recommend `pg_dump`/`pg_restore` workflows generally "for business continuity, disaster recovery,
or compliance" (neon.com/docs/manage/backups) — they don't name "a Neon-side outage or account issue" specifically, but that's the
concrete instance of that guidance relevant here: Path 1 lives entirely inside Neon's own control
plane, so it wouldn't help at all if Neon itself, or this account's access to it, were the problem.

**When to use it:** Neon's control plane is unavailable or malfunctioning, the account itself is
inaccessible, or you need a portable snapshot that can be restored into _any_ Postgres instance
(not just back into the same Neon project).

**Scripts:** `packages/core/scripts/backup.ts` and `restore.ts` (`pnpm --filter @moe/core run
backup` / `run restore`), mirroring `migrate.ts`'s own shape — thin CLI wrappers around pure,
tested command-builders in `packages/core/src/backup/`. Both run `pg_dump`/`pg_restore` inside a
throwaway `postgres:18-alpine` container (`docker run --rm`) rather than requiring a local Postgres
client install — the image version **must track the production Neon project's own major version**
(`neonctl projects list`'s `pg_version` field), since `pg_dump` refuses outright to dump a server
newer than itself. Neon's project is currently Postgres 18; this is a different pin from the
`postgres:17-alpine` image CI/local dev use as a Neon stand-in, and the two must not be conflated.

**Secret handling:** the connection string is never passed to `pg_dump`/`pg_restore` as a `--dbname`
value — a `--dbname=<uri>` argument is expanded by the container's shell and lands in `pg_dump`'s/
`pg_restore`'s _own_ argv (visible via `docker top <container>`, a distinct process from `docker`
itself). Instead the connection string is split into discrete `PGHOST`/`PGPORT`/`PGUSER`/
`PGPASSWORD`/`PGDATABASE`/`PGSSLMODE` values (`parsePgEnvFromConnectionString`) and written to a
`--env-file` (a path, not a value, so nothing appears in `docker`'s own argv either) — libpq's own
documented env-var mechanism, so no process ever receives the secret via a command-line argument.
`pg_restore` still needs an explicit `--dbname="$PGDATABASE"` (it refuses to run without one of
`-d`/`--dbname` or `-f`/`--file`, and this path wants a real restore rather than a generated script), but that's only the database _name_, never the credential. The temp env file is
deleted immediately after the container exits, on every path (success, failure, or an operator
Ctrl-C/kill mid-run — `SIGINT`/`SIGTERM` handlers plus a `try/finally` both call the same cleanup).

`parsePgEnvFromConnectionString` returns a `Result` rather than throwing — `DATABASE_URL` is
operator-supplied input with several distinct ways to be malformed (not a URL at all; invalid
percent-encoding in the credentials/database segment; a decoded field containing an embedded
`\r`/`\n`/`\0`, which would otherwise inject an arbitrary extra line into the generated env file).
Both scripts call it once, immediately after reading `DATABASE_URL` and before anything else
(printing a confirmation prompt, creating a temp file), so every one of these failure modes surfaces
as a clean, single-line error rather than an uncaught exception reached partway through a run.
`formatEnvFileContents` itself also rejects any value containing `\r`/`\n`/`\0` as a defensive
last check, since it's the function actually writing credentials to disk.

**Running a backup:**

```bash
# Use the DIRECT (non -pooler) hostname here — pg_dump emits SET statements.
DATABASE_URL="<source-direct-connection-string>" pnpm --filter @moe/core run backup
# writes packages/core/.backups/moe-backup-<timestamp>.dump (gitignored)
```

**Running a restore — destructive, confirmation required:**

`restore.ts` runs `pg_restore --clean --if-exists`, which **drops existing objects at the target
before recreating them from the dump.** Two safeguards gate it:

1. `BACKUP_FILE_PATH`'s file name is checked against a shell-safe character allowlist
   (`isShellSafeFileName`) before it's embedded into the container's restore command — it's
   operator-supplied input, not caller-generated, and must never be trusted as pre-sanitized.
2. The confirmation phrase is the target's own **redacted connection string** (credentials
   stripped, everything else visible), not a static phrase — printed by the script itself, so the
   operator has to actually look at what they're about to destroy before confirming, and a
   confirmation copy-pasted for a _different_ database won't match this one:

```bash
# Use the DIRECT (non -pooler) hostname here too — pg_restore emits SET statements.
DATABASE_URL="<TARGET-direct-connection-string>" \
BACKUP_FILE_PATH="<path-to-.dump-file>" \
pnpm --filter @moe/core run restore
# refuses, printing: CONFIRM_RESTORE_TARGET=postgres://<user>@<host>:<port>/<database>
# re-run with that exact line added to confirm
```

**Known limitation — untested, undocumented-until-now edge case:** `BACKUP_OUTPUT_DIR`/the dump
file's own directory are passed to `docker run -v` as `<host-path>:/backups[:ro]`. A host path
containing a literal `:` would break Docker's own `HOST:CONTAINER[:MODE]` volume-spec parsing.
Not exploitable (both scripts invoke `docker` without a shell, so this isn't injectable — it would
just fail loudly), and not a real constraint on this repo's Mac/Linux deploy targets, but there's
no test covering it and no code guards against it either.

---

## Rehearsal evidence (live-verified 2026-07-24)

Both paths were run for real against the actual Neon production project before this doc was
written — not just read from Neon's docs.

**Path 1 (PITR):**

1. Applied all 16 migrations to the real project (`plain-wildflower-25588697`, branch
   `production` / `br-patient-mode-zah4xec5`).
2. Captured `SELECT now()` from the live DB as T0: `2026-07-24T02:38:48.565Z`.
3. Inserted a marker ticket row, confirmed present.
4. Ran `neonctl branches restore br-patient-mode-zah4xec5 "^self@2026-07-24T02:38:48.565Z"
--project-id plain-wildflower-25588697 --preserve-under-name pre-pitr-rehearsal-backup`.
5. Polled until `current_state: ready`.
6. **Confirmed the marker row was gone** (proves the rewind actually happened, not just that the
   command returned success) **and `schema_migrations` still showed all 16 rows** (proves it
   restored to the post-migration point T0, not a blank database).
7. Deleted the preserved pre-restore branch once confirmed correct.

**Path 2 (pg_dump/pg_restore):**

1. Inserted a second marker row into the real Neon project.
2. `pnpm --filter @moe/core run backup` against `NEON_DATABASE_URL` — produced a real dump file.
3. Restored that dump into a fresh, unrelated local Postgres database (not Neon at all — proving
   portability to any Postgres target, the whole point of this path) via `pnpm --filter @moe/core
run restore`.
4. Confirmed all 11 tables and the marker row present in the restored database.
5. Cleaned up: deleted the marker row from the real Neon project, dropped the scratch local
   database, deleted the local dump file.

## See also

- `docs/decisions/TOPOLOGY-AND-DATABASE.md` — why N machines and Neon Postgres were chosen.
- `BUILD_PLAN.md` chunk 4.6 (restore paths) and chunk 5.2 (the persona fleet).
- `packages/core/src/backup/` — the tested command-builder functions Path 2's scripts wrap.
- `packages/core/src/deploy/` — the tested builder the eight `fly.<persona>.toml` files come from.
