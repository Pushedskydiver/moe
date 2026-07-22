---
status: Decided
date: 2026-07-22
---

# Board Home & Capacity Model

## Decision

Closes VISION §3.1/§3.4's open capacity-model question and BUILD_PLAN chunk 4.3's board-home question with four discrete calls: **moe's own DB stays the canonical board** (GitHub issues are the external mirror, not the board itself); **two classes of service** (Standard, Expedite); **a new explicit `classOfService` ticket-schema field** (not derived from `severity`); and **small starting WIP limits** (Brief 3, Plan 2, Build 2, Review 2; Backlog/Done uncapped), revisable once real throughput data exists.

## Context

VISION §3.1 flagged WIP limits and classes of service as unresolved even for the single-project build, to be settled before board code is written (§3.4). Separately, BUILD_PLAN's own chunk 4.3 framing asked where the board lives at all — citing "GitHub Projects v2 (old VISION's answer)" as one option, though that prior design isn't retained anywhere checkable in this repo (`docs/VISION.md`'s own front-matter note) and VISION.md itself never names Projects v2. Decided directly with Alex (four discrete choices, each with a strong-evidence recommendation put forward), not researched — the board-home question resolves from evidence already in this codebase; the capacity-model questions are policy calls with no historical throughput data to calibrate against yet.

## Decisions

1. **Board home — moe's own DB.** The `tickets` table (chunk 1.2b onward) is already load-bearing: atomic optimistic-lock claims (`claim.ts`) and real ticket creation via the reaction gate (`reaction-outcome-actions.ts`). More broadly, moe's DB as a whole is load-bearing across the entire intake pipeline sibling tables live in — the review-queue sweep, draft-outcome tracking — none of which has any GitHub Projects v2 analogue built or even sketched. GitHub Projects v2 has zero existing code in this repo. Chunk 4.2 already treats GitHub issues as a separate triage/mirror table (`github_issue_triage`), not the board itself, and 4.4b's own plan is to create/link GitHub issues _from_ tickets — the DB-first direction was already the trajectory in motion before this gate. Rejected: switching to Projects v2 as canonical — would mean rebuilding the entire claim/reaction-gate/sweep machinery against its GraphQL API and field model instead of Postgres, a large, currently-unscoped rework with no code head start.
2. **Classes of service — Standard + Expedite, two classes.** Expedite = anything from `#moe-incidents` (VISION §6.1's own purpose for that channel: "Bugs, regressions, postmortems.") or `severity: 'Critical'`; jumps ahead of Standard work within its board status. Matches moe's established build-small-first pattern (4.1's read-only-first, 4.2's no-webhook-first). Rejected: the full four-class textbook Kanban scheme (Expedite/Fixed-Date/Standard/Intangible) — "Fixed-Date" (externally-imposed deadline) and "Intangible" (do-eventually, no urgency) have no real trigger in chief-clancy today; nothing currently imposes external deadlines, and "Intangible" work is arguably just what Backlog already models.
3. **New explicit `classOfService` field, not derived from `severity`.** Queue-jump treatment (class of service) and business-impact rating (severity) are different Kanban concepts and should stay independently settable. `severity` is also currently a hardcoded `'Medium'` placeholder everywhere a ticket gets created (`reaction-outcome-actions.ts`'s `DEFAULT_SEVERITY`, itself an `AskUserQuestion`-confirmed stopgap "until a real triage signal exists") — deriving class of service from it would be inert until that placeholder becomes real in some later, currently-unscheduled chunk. Named as a follow-up migration to `packages/core`'s tickets table (chunk 4.5, not built in this decision-only chunk) rather than silently absorbed.
4. **WIP limits — small starting caps, revisable.** Brief: 3, Plan: 2, Build: 2, Review: 2. Backlog and Done stay uncapped (a queue and a terminal state don't need a ceiling). No real throughput data exists to calibrate against — the same situation `TRACK-RECORD-DEFINITION.md`'s N=5 threshold faced, resolved the same way: a reasoned starting number rather than waiting for data that can't exist yet (personas beyond Sarah's intake listener aren't built — the cast stands up together at Stage 5, which hasn't shipped). Chunk 4.5 enforces these numbers at pull time once a claim/pull mechanism exists to check them against. Rejected: no hard limit yet, advisory-only reporting — a real, considered alternative, but BUILD_PLAN 4.3's own text asks this gate to produce actual numbers, and a small, explicitly-revisable starting cap is more useful signal than pure visibility with no ceiling at all.

## Deferred / explicitly rejected

- Cross-project WIP limits, `team.config.ts`, and cross-project Kanban remain out of scope — VISION §3.4's multi-project posture is deferred, not this gate's concern.
- The `classOfService` migration itself is not built here — named as chunk 4.5's own follow-up (not the 1.1/1.2b that chunk 4.3's own original text loosely pointed at, since those chunks already shipped; 4.5 is the chunk that actually enforces classes of service and needs the field to exist first), per BUILD_PLAN 4.3's explicit instruction not to silently absorb it.

## Triggers for re-evaluation

- Once personas beyond Sarah exist (Stage 5+) and real pull/throughput data accumulates, revisit whether Brief/Plan/Build/Review's 3/2/2/2 caps are too tight (work stalls waiting for capacity) or too loose (no real ceiling effect).
- If a real externally-imposed-deadline or do-eventually-no-urgency work pattern emerges in chief-clancy that Standard/Expedite doesn't distinguish well, revisit the two-class scheme.
- If GitHub Projects v2 gains a compelling reason to become canonical later (e.g. Alex wants the board visible/editable outside Slack+moe), revisit — nothing here forecloses linking an external Projects v2 view to moe's DB as a _read-only mirror_ the way GitHub issues already are.

## References

- `docs/VISION.md` §3.1 (ScrumBan) and §3.4 (Multi-project posture) — the open question this ADR resolves.
- `BUILD_PLAN.md` chunk 4.3 — this chunk. Its output (the `classOfService` migration + numbers) is enforced at chunk 4.5.
