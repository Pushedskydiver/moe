# Operations

Manual operational runbooks for moe's production database — how to restore it, and when to use
which path. `docs/DEVELOPMENT.md` covers day-to-day dev workflow; this doc covers what to do when
production data is at risk. Built at BUILD_PLAN chunk 4.6, the chunk that closes Stage 4 —
`docs/decisions/TOPOLOGY-AND-DATABASE.md` chose Neon Postgres for production but explicitly left
its PITR/branching retention specifics "not independently vetted in depth" and flagged this chunk
to verify them before relying on it. That verification, and a live rehearsal of both restore paths
below, happened directly against the real Neon project ("Moe AI Team",
`plain-wildflower-25588697`) before this doc was written.

No automation or scheduling exists for either path yet — both are manually-triggered, matching
every other operational script in this repo (`migrate.ts`, the review-queue sweep,
`create:github-issues`). A scheduled/unattended backup job is future work once real production
traffic and a scheduler exist; building one now would be inventing infrastructure ahead of need.
Likewise, a documented production _migration_ process is a separate, not-yet-closed gap (today
`migrate.ts` has only ever been run against local/rehearsal databases by hand) — out of scope here,
since this doc covers restoring already-written data, not schema deployment.

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

**CLI syntax** (scriptable — not console-only):

```bash
neonctl branches restore <branch-name-or-id> "^self@<ISO-8601-timestamp-millisecond-precision>" \
  --project-id <project-id> \
  --preserve-under-name <name-for-the-preserved-pre-restore-branch>
```

- The timestamp must be millisecond precision (`2026-07-24T02:38:48.565Z`) — microsecond-precision
  timestamps (what Postgres's own `now()` returns) are rejected and must be truncated first.
- `^self@<timestamp>` restores the branch to a point in its _own_ history. `^parent` restores to
  the head of its parent branch instead; a specific branch ID/name restores to _that_ branch's
  head. See `neonctl branches restore --help` for the full source-format grammar.
- The restore is asynchronous — poll `neonctl branches get <branch-id> --project-id <project-id>`
  until `current_state` reads `ready` before assuming it's done.
- Requires a Neon **API key** (Account Settings → API Keys in the console) exported as
  `NEON_API_KEY`, or passed via `--api-key` — this is a control-plane credential, distinct from the
  database connection string, and authenticates `neonctl` non-interactively.
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

A traditional logical backup/restore, independent of Neon's own control plane — Neon's own docs
recommend this specifically for business continuity against a Neon-side outage or account issue,
where Path 1 (which lives inside Neon) wouldn't help at all.

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

**Secret handling:** the connection string is passed to the container via `--env-file` (a path, not
a value) rather than as a `docker`/`pg_dump` command-line argument, so it never appears in `docker`'s
own argv (host-visible via `ps`) — only the short-lived container's own shell ever expands it. The
temp env file is deleted immediately after the container exits, on every path (success or
failure) — cleanup runs before any `process.exit()` call, since `process.exit()` does not run
pending code after it.

**Running a backup:**

```bash
DATABASE_URL="<source-connection-string>" pnpm --filter @moe/core run backup
# writes packages/core/.backups/moe-backup-<timestamp>.dump (gitignored)
```

**Running a restore — destructive, confirmation required:**

```bash
DATABASE_URL="<TARGET-connection-string>" \
BACKUP_FILE_PATH="<path-to-.dump-file>" \
CONFIRM_RESTORE_TARGET=yes-drop-existing-data \
pnpm --filter @moe/core run restore
```

`restore.ts` runs `pg_restore --clean --if-exists`, which **drops existing objects at
`DATABASE_URL` before recreating them from the dump.** It refuses to run at all unless
`CONFIRM_RESTORE_TARGET` exactly matches the literal phrase above — this exists to catch a
copy-pasted wrong connection string before it destroys real data, not to gate a scenario that
can't happen. Double-check `DATABASE_URL` points at the intended target before setting it.

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

- `docs/decisions/TOPOLOGY-AND-DATABASE.md` — why Neon Postgres was chosen for production.
- `BUILD_PLAN.md` chunk 4.6 — the chunk this doc closes out.
- `packages/core/src/backup/` — the tested command-builder functions Path 2's scripts wrap.
