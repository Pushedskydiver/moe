---
status: Decided
date: 2026-07-15
---

# Cast Roster

## Decision

**Keep the previous cast's seven-role roster as the working default** — Sarah (PM), Marcus (Architect), Riley (Engineer), Priya (QA), Dom (Reviewer), Theo (Researcher), Nia (Scrum Master). **Sarah is confirmed as the first/front-door persona** Stage 2 builds against. **The 8th role, Designer, is deferred** to the 5.0 gate. **A new safeguard against persona-framing's documented scrutiny/accountability risk is added to VISION §8.2.**

## Context

VISION §4.1 carried the previous (shelved) design's cast forward as an explicit placeholder — "Alex is explicitly open to reconsidering names, roles, and count." BUILD_PLAN chunk 2.1 is the gate that closes this, per CLAUDE.md's do-not-touch list (§4.1 requires this conversation before any edit). Unlike chunk 1.2a (topology/DB) and chunk 1.5 (track-record), this gate has no single external fact to discover — Alex asked for a deep-research pass to check whether the existing roster and the general practice of named, personality-driven AI personas are actually well-evidenced, with the explicit instruction to defer the Designer role only if the research supported deferring it with real evidence, rather than deferring it by default. The research found no evidence either way on Designer-timing specifically (see below) — so the deferral below rests on a separate, independent argument (chief-clancy's own lack of UI/UX surface), not on the research affirmatively recommending deferral.

A deep-research pass (105 sub-agents, 23 sources fetched, 25 claims put to adversarial vote: 14 confirmed, 11 refuted) covered five angles: multi-agent team-size/coordination overhead, role-decomposition validity, anthropomorphized-persona risk, Designer-role timing, and the real competitive cast-size landscape.

## What the research found

**Confirmed, strong evidence:**

1. **Multi-agent team-size dilution is real, but only weakly transferable to moe's architecture.** A 2026 ICML-accepted paper (arXiv:2602.01011) found LLM multi-agent teams reliably underperform their own single best member via "integrative compromise" — averaging expert and non-expert views instead of weighting by expertise — which worsens as team size grows (tested at 2/4/8 agents). A separate paper (arXiv:2604.02460) found single agents match/beat multi-agent systems under equal compute. Both findings come from committee-style studies where agents jointly produce one output — not moe's actual topology (independent long-running processes claiming separate tickets via DB-level optimistic locking, minimal joint deliberation). Real caution against "more agents is free" as a general principle; not a direct refutation of moe's specific design.
2. **Anthropomorphized, named AI personas carry documented, measured backfire risk.** A 10-country, N≈3,500 experiment (arXiv:2512.17898) found humanlike AI design does not reliably increase actual trusting _behavior_ (only self-reported trust, inconsistently across cultures). A BCG/HBR controlled study (1,200+ professionals) found framing AI as a named "employee" led reviewers to catch fewer errors and report less accountability for a mistake — blaming the AI agent rather than themselves — while raising job-security concern (7% higher) and lowering deployment trust (10% lower) — quoted as the source states it, a relative comparison, not a percentage-point shift — the opposite of what persona-naming is assumed to buy. (Fetched and re-verified directly against the source article, 2026-07-15 — no error-detection or blame-shift percentage is actually stated in it; only the directional finding is, so none is claimed here.) Two real corroborated incidents reinforce this: the already-known "Viktor" skull-emoji-at-a-layoff-announcement, and professional journalists (Reuters, Newsweek, CNBC, The Guardian) mistaking a user-prompted first-person AI "apology" for an official corporate statement.

**No reliable evidence found, despite genuine effort — every claim advanced on these fronts failed adversarial verification:** whether the PM/Architect/Engineer/QA/Reviewer/Researcher/ScrumMaster split is well-evidenced or redundant against alternatives; whether deferring a dedicated Designer role is standard/justified practice for a backend-only product at this stage; and what cast sizes/role compositions real competing "AI coworker" products actually ship with today. This silence is a genuine evidentiary gap, not a quiet confirmation either way.

## Rationale

- **Keep the 7-role decomposition, don't rework it**: the research's silence here is symmetric — it neither confirms nor disproves this split, and that same silence would equally fail to justify picking a different one. The real argument for keeping it is switching cost, not evidence: reworking would trade a shape with the previous design's own production experience behind it (even though its detailed personality artifacts aren't preserved) for a differently-shaped guess with no more evidence behind it than the status quo has. That's a judgment call, not a finding — flagged explicitly so a future reader doesn't mistake absence-of-evidence for evidence-of-fitness.
- **Defer Designer**: no research surfaced a reason to add it now, and chief-clancy — this rebuild's sole target through Stage 4 — has no real end-user UI/UX surface yet for a Designer to work against. This is a scope-matching argument independent of the research's own silence on Designer-timing specifically.
- **Confirm Sarah as first persona**: matches VISION's own stated default and the previous design's front-door (PM) role — the natural first point of contact for intake/triage, which is exactly what Stage 2's exit criterion needs (responds to a DM, evidence-gated status claims).
- **Add the scrutiny-risk safeguard**: the BCG/HBR finding directly undercuts an assumption moe's persona-naming design currently makes, on an axis VISION §7.6 doesn't already cover (§7.6 guards against the AI fabricating a claim; this guards against the _human_ reviewer under-scrutinizing a true one because it's attributed to a named, trusted-sounding persona). Real, on-point, actionable — added to §8.2 rather than left as an unaddressed research footnote.

## Deferred / explicitly rejected

- **Reworking the role decomposition itself** — not rejected on evidence (none exists either way), rejected as premature: no comparable research or product data supports a different split over this one.
- **Adding Designer now** — not rejected outright, deferred to the 5.0 gate per BUILD_PLAN's own existing escape hatch, revisit sooner if chief-clancy gains real UI/UX surface. `BUILD_PLAN.md`'s "Deliberately not scheduled" section already carries a working name for this role ("Maya") — that predates this ADR, was never a formal decision, and isn't reconciled here; the 5.0 gate confirms or replaces it when the role is actually activated.
- **The welcome ritual** (how a new persona is socially introduced to the team) and **full per-persona personality/voice authorship** are both distinct, still-open matters untouched by this gate — the former a separate "team feel" question, the latter explicitly chunk 5.3's own scope (one persona at a time, drafted directly with Alex, the do-not-touch surface), not manufactured here since the previous design's actual personality sketches aren't preserved anywhere retrievable.

## Triggers for re-evaluation

- Real evidence surfaces (a published case study, a comparable product's postmortem) directly bearing on role-decomposition validity, Designer-role timing, or competitive cast-size norms — none was found despite a genuine search.
- chief-clancy grows real end-user UI/UX surface before the 5.0 gate, making the Designer-deferral's scope-matching argument stale.
- Moe's own operational experience surfaces evidence that its independent-process, DB-locked-claim topology _does_ exhibit the "integrative compromise" dilution mechanism the committee-style studies found — currently an open inference gap, not observed in practice.

## References

- Deep-research pass, 2026-07-15: 105 sub-agents, 23 sources, 25 claims adversarially voted (14 confirmed / 11 refuted). Primary sources: [arXiv:2602.01011](https://arxiv.org/abs/2602.01011) (team-size dilution), [arXiv:2604.02460](https://arxiv.org/html/2604.02460v1) (single-agent vs. multi-agent under equal compute), [arXiv:2503.13657](https://arxiv.org/abs/2503.13657) (MAST — confirmed VISION's own "79%" citation is directionally accurate but a derived sum, not a literal source quote; a citation-fidelity footnote for VISION §3.3, not this gate's own decision), [arXiv:2512.17898](https://arxiv.org/html/2512.17898v1) (cross-national anthropomorphization trust experiment), [Fortune, 2026-05-28](https://fortune.com/2026/05/28/ai-employees-org-chart-human-workers-blame-errors-bcg-study/) (BCG/HBR named-AI-employee scrutiny/blame study), [Fortune, 2026-05-19](https://fortune.com/2026/05/19/viktor-ai-startup-raises-75-million-for-virtual-coworker-exclusive/) (Viktor incident), [techpolicy.press](https://www.techpolicy.press/anthropomorphism-is-breaking-our-ability-to-judge-ai/) (journalist/AI-apology incident).
- `docs/VISION.md` §4.1 (the section this ADR resolves), §8.2 (the new safeguard), §7.6 (the distinct fabrication-focused fix this complements).
- `BUILD_PLAN.md` chunk 2.1 — this chunk. Chunk 5.3 (persona prompts) and the 5.0 gate carry the deferred work forward.
