---
status: Decided — decline for now
date: 2026-07-09
---

# Session-Handoff Automation

## Decision

Keep manual handoff (`PROGRESS.md` + loading-instructions blocks) as the primary cross-session-continuity mechanism. Decline LLM-authored handoff automation (an auto-generated summary written by a hook). Adopt event-based revisit triggers instead of imported numeric thresholds.

## Context

Chief-clancy investigated automating session handoff (a `PostCompact` hook + Routines substrate writing an LLM summary), declined, and adopted "measure before automating" with numeric thresholds calibrated against its own session history. Moe ported that stance as an unexamined placeholder. Session 2 tested whether it holds up: a deep-research pass (live hook docs, published summary-fidelity evidence, cross-tool comparison) plus a direct read of chief-clancy's own primary-source audits (`@chief-clancy/.claude/research/session-handoff/audit-2026-04-{21,23,29}.md`, 40 sessions across four windows).

## Positions evaluated

|       | Position                                                                              | Verdict                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Manual handoff stays primary; decline LLM-authored automation                         | **CHOSEN**                                                                                                                                      |
| **B** | Adopt a `PostCompact`/Routines hook writing an LLM summary now                        | Rejected — evidence-backed omission risk, and the harm it guards against (unplanned compaction) never fired in chief-clancy's 40-session record |
| **C** | Import chief-clancy's numeric thresholds (handoff-cost median, backfill fields) as-is | Rejected — their thresholds drifted out of meaning within 20 sessions and their own backfill discipline collapsed                               |
| **D** | Deterministic pointer-injection hook (no LLM authorship) as a chunk now               | Deferred — no trigger has fired yet to justify building it                                                                                      |

## Rationale

1. **The tooling-maturity half of chief-clancy's original reasoning is stale.** The beta label attached to the Routines cloud substrate (research preview as of 2026-04), not to hooks. `PostCompact` has since shipped and command hooks carry no beta label as of July 2026 ([code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)) — automated handoff is buildable today.
2. **The summary-quality half hardened into measured-risky.** LLM compaction summaries fail by omission, unpredictably, and the omission is undetectable from the compacted context alone (arXiv 2606.11213, adversarially verified). Consistent secondary evidence: faithfulness far exceeds completeness on long inputs; production compression strategies score worst on exactly the file/artifact state a resumed session needs; hallucination detectors run near chance, so a bad summary can't be cheaply machine-caught.
3. **Chief-clancy's own 40-session measurement says automation solves the wrong problem.** 0/40 unplanned compactions — the harm a `PostCompact` backstop addresses never fired once. Handoff cost grew, but their own cause analysis attributed it to information density (sessions doing more), which automation doesn't reduce. Their final audit recommended formally retiring the workstream.
4. **Their measurement protocol itself decayed** — 19/20 metric fields left unfilled across their last two audited windows. A protocol that isn't sustained is worse than none; moe adopts event-based triggers (below) instead of a per-session bookkeeping habit likely to suffer the same fate.

Full evidence and citations: `docs/DEVELOPMENT.md` §Session handoff → "On automating handoff — researched position."

## Deferred work: deterministic pointer-injection hook

If a revisit trigger fires, the preferred mechanism is a `SessionStart(compact)`/`PostCompact` hook injecting a **pointer** to `PROGRESS.md` — no LLM authorship, so none of the summary-quality risk in Rationale §2 applies. Not prototyped; not scoped into `BUILD_PLAN.md`.

## Triggers for re-evaluation

- An unplanned compaction costs real state (work redone, a decision lost).
- A cold-load fails: clarifying questions needed, or factual errors caught in a `PROGRESS.md` entry.
- Handoff authoring visibly crowds out end-of-session work, repeatedly.

One firing is a data point, not a build order; a second of the same class is a design signal. If this decision changes, it enters `BUILD_PLAN.md` as its own chunk with Alex's sign-off — not a rider on other work.

## References

- `docs/DEVELOPMENT.md` §Session handoff — full mechanics and evidence.
- `@chief-clancy/.claude/research/session-handoff/audit-2026-04-{21,23,29}.md` — the primary-source audits this decision re-derives from.
- Repo-local `.claude/research/session-handoff-automation/research-2026-07-09.md` (gitignored) — the Session 2 deep-research artefact.
