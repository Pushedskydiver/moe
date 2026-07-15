---
status: Decided
date: 2026-07-11
---

# Process Topology × Database

## Decision

**N machines, one per persona, backed by Neon Postgres.** Rejects the single-machine + SQLite-on-volume + Litestream shape BUILD_PLAN originally scoped as the cheaper default.

## Context

BUILD_PLAN chunk 1.2a's own text framed this as: one machine running all N persona processes (via a supervisor, since Fly's `[processes]` config spawns separate machines per group) with SQLite-on-volume + Litestream backup, versus N separate machines each needing a shared remote Postgres (LiteFS disqualified — single-writer, and Fly's own docs say "not able to provide support or guidance for this product"). The one-machine/SQLite shape was framed as the cheaper option (~$12–25/mo vs ~$20–80/mo), trading cost for blast radius (one crash downs every persona together).

Alex asked for real evidence before deciding, open to either option. A deep-research pass (109 claims extracted across 26 sources; the claims this Rationale draws on were each adversarially verified against live sources, not assumed from the original 2026-07-04 research) found the framing needed correcting on three fronts.

## Positions evaluated

|       | Position                                                                                                    | Verdict         |
| ----- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| **A** | One machine (all personas), SQLite + Litestream — via overmind or Fly's native multi-container Machines API | Rejected        |
| **B** | N machines (one per persona), Fly Managed Postgres                                                          | Rejected — cost |
| **C** | N machines (one per persona), Neon Postgres                                                                 | **CHOSEN**      |

## Rationale

1. **Litestream has an ongoing pattern of silent-replication-failure bugs, not a single resolved incident.** [Issue #1083](https://github.com/benbjohnson/litestream/issues/1083) (v0.5.6/v0.5.7, a WAL-space-reuse edge case that freezes sync metrics with zero error/log signal) got a fix merged 2026-02-20 (PR #1087) — but that fix was **reverted** 2026-03-05 (PR #1185), and a follow-up re-fix attempt (PR #1186) was closed **without merging** the next day. The bug has been unfixed across every release since (v0.5.10 through the current v0.5.14, 2026-03-19 through 2026-07-06 — nearly 4 months). Two more open, distinct silent-failure-class issues corroborate the pattern: [#1310](https://github.com/benbjohnson/litestream/issues/1310) (initial sync wedges silently when local staging fills the disk, opened 2026-06-12) and [#1323](https://github.com/benbjohnson/litestream/issues/1323) (a WAL increment can drop newly-allocated pages, restore-fatal, opened 2026-06-28). This is the worst possible failure mode for atomic ticket-claim state, where silent corruption is far more costly than a loud, monitored failure — and a fix attempt that didn't stick is a weaker signal than a bug nobody's tried to fix yet. Litestream's replication is also async by default ([~1s interval](https://litestream.io/reference/config/)), so RPO isn't zero even on a build where sync is otherwise working.
2. **A better version of the single-machine option exists than what was originally scoped, and it still doesn't change the recommendation.** Fly ships a native multi-container Machines API (`containers` array, Pilot init system) giving real process/filesystem isolation between co-located processes — "failures in one container won't directly crash others" (verified live against [Fly's docs](https://fly.io/docs/machines/guides-examples/multi-container-machines/)). This is a real upgrade over `overmind` (whose own creators [scoped it to development use](https://evilmartians.com/chronicles/introducing-overmind-and-hivemind), requires tmux as a hard dependency, and whose default behavior is to interrupt every process when any one dies unless explicitly configured otherwise). But it only solves process-level isolation — containers on one machine still share a kernel and VM, so a host-level incident still takes every persona down together. It doesn't touch the Litestream durability concern either.
3. **Host-level blast radius is a real, evidenced risk, not just theoretical.** Fly's own platform runs 25–30 incidents of varying severity per month (community tally against Fly's status history; most affect a subset of customers, not the whole platform). N separate machines reduce — don't eliminate — the chance every persona goes down together.
4. **Postgres isn't incident-free either, but it fails visibly.** Both Fly Managed Postgres and (by extension) managed Postgres generally have real, recent, documented incidents (a SYD disk-I/O-saturation event took MPG clusters unhealthy; a cluster of MPG incidents in June/July 2026 included failed failovers and connection errors). These show up on public status pages with active incident response — a materially different risk profile from Litestream's silent-by-design failure mode, independent of raw incident-rate comparison.
5. **The cost gap is much narrower than BUILD_PLAN's original framing assumed, once Neon replaces Fly Managed Postgres as the comparison point.** MPG's $38/mo floor (Basic tier) drove the "~$20–80/mo" side of the original estimate. Neon is usage-based ($0.106/CU-hour on Launch, $0.35/GB-month storage, no monthly minimum) with a free tier (100 CU-hours/month, 0.5GB storage) that plausibly covers this workload's actual traffic at this stage. Realistic total cost for option C is likely **$0–30/mo**, not meaningfully more than option A's own ~$10–15/mo (one machine sized for N processes + a volume + Litestream backup storage) — removing cost as a strong reason to prefer the single-machine shape. (Illustrative sizing only — the cast count was an open placeholder at the time of this ADR, since settled at BUILD_PLAN chunk 2.1: 7 personas, an 8th deferred — see `docs/decisions/CAST-ROSTER.md`.)

## Deferred / explicitly rejected

- **Overmind is rejected outright**, not just de-prioritized — don't reach for it later out of habit if a single-machine shape ever gets revisited.
- **Neon's scale-to-zero behavior** (free/low tiers idle out after 5 minutes) could introduce cold-start latency on a ticket claim after a quiet period — worth checking at 1.2b if traffic patterns make this a real concern; not a blocker now.
- **Neon offers point-in-time-recovery/branching** as part of its managed service (confirmed real on its pricing page) — a real candidate for chunk 4.6's backup/restore story, not independently vetted in depth here; 4.6 should verify current retention-window specifics before relying on it.
- **1.2b (database layer + tickets table)** builds against this decision: Neon Postgres, migrations tooling, the tickets table, plain CRUD — no claiming logic yet (that's 1.3).

## Triggers for re-evaluation

- Neon's free/low-tier pricing changes materially unfavorably.
- Litestream ships a fix for the silent-replication-failure class that actually sticks (survives multiple releases without being reverted, unlike the Feb 2026 attempt), _and_ a track record without further incidents of the same kind, _and_ cost pressure (e.g. post-revenue growth) makes the single-machine shape worth revisiting.
- A real, observed need emerges to co-locate persona processes for reasons other than cost (unlikely given the process-topology decision in VISION §4.5 is already settled independently of this DB choice).

## References

- Live-verified against current docs, 2026-07-11: [Fly volumes overview](https://fly.io/docs/volumes/overview/), [Fly LiteFS docs](https://fly.io/docs/litefs/), [Fly multi-container Machines](https://fly.io/docs/machines/guides-examples/multi-container-machines/), [Fly infra-log](https://fly.io/infra-log/), [Fly status history](https://status.flyio.net/history), [Fly Managed Postgres docs](https://fly.io/docs/mpg/), [Fly pricing](https://fly.io/docs/about/pricing/), [Neon pricing](https://neon.com/pricing), [Overmind](https://github.com/DarthSim/overmind), [Overmind's 2017 introduction (development-only scoping)](https://evilmartians.com/chronicles/introducing-overmind-and-hivemind), [Litestream config reference (sync interval)](https://litestream.io/reference/config/).
- Litestream issue/PR timeline (checked directly via the GitHub API, 2026-07-11, not just the research artefact — a review pass found the artefact's own account incomplete): [#1083](https://github.com/benbjohnson/litestream/issues/1083), [fix PR #1087](https://github.com/benbjohnson/litestream/pull/1087) (merged 2026-02-20), [revert PR #1185](https://github.com/benbjohnson/litestream/pull/1185) (merged 2026-03-05), [re-fix attempt PR #1186](https://github.com/benbjohnson/litestream/pull/1186) (closed without merging, 2026-03-06), [#1310](https://github.com/benbjohnson/litestream/issues/1310), [#1323](https://github.com/benbjohnson/litestream/issues/1323).
- Repo-local deep-research artefact (gitignored): `.claude/research/topology-database-2026-07-11/` — the raw 109-claim verification run this decision was synthesized from directly, after the workflow's own automated synthesis step failed (returned placeholder output rather than a real report).
