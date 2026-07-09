# Glossary

Ubiquitous language for moe — use consistently in code, docs, commits, and persona prompts. Shape adapted from chief-clancy's own `GLOSSARY.md` (category-grouped term tables, each entry linking to its authoritative doc section); the terms themselves are moe's own, not a port — chief-clancy's terminology is almost entirely specific to its own installer/board/pipeline system, which moe doesn't have.

`docs/VISION.md` Appendix B lists several terms as "carried forward unchanged from the previous design's glossary." That prior design is gone and unretrievable (`CLAUDE.md` §Status; see moe's own git history for the ground-up rebuild rationale) — the entries below define those terms from where moe's own current docs actually use them, or from their standard industry meaning where moe hasn't specified anything narrower yet. Where a term is still an open question rather than a settled definition, the entry says so.

## Anti-fabrication (VISION §7.6)

| Term                        | Definition                                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Execution hallucination** | An agent claiming to have completed a sub-stage of work it did not actually complete. The academic name for the second of moe v3's three named failure modes (`CLAUDE.md` §Status; `docs/VISION.md` §0). |
| **Evidence-gated claim**    | A status statement a persona is structurally prevented from emitting unless it's backed by a real `toolCallId`/`toolOutputSnippet` pair.                                                                 |
| **Ungrounded fabrication**  | A claim with no tool-call evidence at all — closed by the evidence-gated-claim schema itself.                                                                                                            |
| **Misgrounded fabrication** | A claim backed by real but irrelevant evidence. Closed only for Tier 2/3 claims (see Autonomy & trust, below), by independent verification — the schema gate alone doesn't catch it.                     |

## Autonomy & trust (VISION §8)

| Term             | Definition                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Risk tier**    | The path × change-shape classifier that gates how much review a change needs before merge (`docs/VISION.md` §8.1) — replaces the old time-gated Probation model entirely.                                                                                                                                                                         |
| **Tier 1**       | Fast single-approve, same-day. Logic change with an accompanying test, in a path the agent has a track record on.                                                                                                                                                                                                                                 |
| **Tier 2**       | Standard review. Any logic change without an accompanying test, a path with no track record, or a diff crossing package boundaries.                                                                                                                                                                                                               |
| **Tier 3**       | Mandatory named-owner review, cannot be satisfied by the requesting persona or the human who dispatched it. Auth, payments, PII/secrets, CI/CD config, migrations, or any destructive operation, regardless of track record — a hard floor autonomy doesn't earn past.                                                                            |
| **Track record** | A path's history of unreverted merges; shifts a change down at most one tier, and never into Tier 3. What counts as a path's track record for a diff spanning multiple directories, a directory rename, or a brand-new directory is an **open definitional question** (`docs/VISION.md` §8.1) — don't build tier logic against an assumed answer. |
| **Trust Level**  | The previous design's time-gated Probation → Trusted → Veteran ladder. **Superseded** by the risk-tier model above — there is no more Probation phase gating all pulls.                                                                                                                                                                           |
| **Veto signal**  | Alex's 🛑 reaction, which holds a merge. Carries over conceptually from the previous design (`docs/VISION.md` §8.2); not yet built.                                                                                                                                                                                                               |

## Team & ceremonies (VISION §3, §6)

| Term                   | Definition                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ScrumBan**           | Moe's process model: Kanban flow (continuous pull, WIP limits) plus Scrum-style ceremonies layered on top (`docs/VISION.md` §3.1).                                                                                                                                                                                 |
| **Ceremony**           | A structured, scheduled team ritual (e.g. weekly replenishment, monthly review) — `docs/VISION.md` §3.2; specific ceremony formats live in `docs/CEREMONIES.md` once written (do-not-touch surface, `CLAUDE.md`).                                                                                                  |
| **Brief**              | A work-scoping artifact a persona produces before implementation (illustrated in `docs/VISION.md` §1.3's day-in-the-life dialogue: "Sarah's brief for the packages issue"). Not yet formally specified as a schema or command — narrative usage only as of Stage 0.                                                |
| **EOD digest**         | The end-of-day summary a persona posts to the team channel, standing in for a standup (`docs/VISION.md` §6.5) — Alex is continuously present in the channel, so a bolted-on standup on top would be redundant.                                                                                                     |
| **Core hours**         | The window during which proactive persona behavior (sends, intake drafts) is allowed; off-hours defers to the next window. Concrete parameters (default 09:00–17:30 Europe/London Mon–Fri, GOV.UK bank-holiday source) are settled at `BUILD_PLAN.md` chunk 2.7a, not here — `docs/VISION.md` §6.4 delegates them. |
| **Away-detection**     | Reading Alex's Slack status text/emoji against a keyword list to suppress off-hours proactive behavior further (`BUILD_PLAN.md` chunk 2.7b). The exact keyword list is an open Appendix-A question in `docs/VISION.md`.                                                                                            |
| **Classes of Service** | A Kanban capacity concept (work-item categories with different WIP/priority treatment). Single-project classes of service are in-scope but **not yet resolved** (`docs/VISION.md` §3.1) — must be settled before board code is written.                                                                            |
| **WSJF**               | Weighted Shortest Job First — a prioritization technique (cost of delay ÷ job size). Named in VISION Appendix B as carried-forward vocabulary; not yet wired into any moe mechanism.                                                                                                                               |

## Review & process (`docs/DEVELOPMENT.md`, `docs/DA-REVIEW.md`)

| Term                         | Definition                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chunk**                    | A single unit of `BUILD_PLAN.md` work — one PR, one review gate, per `CLAUDE.md`'s process directives.                                                                              |
| **Stage**                    | A group of chunks in `BUILD_PLAN.md` ending in something observable working end-to-end.                                                                                             |
| **[GATE] chunk**             | A chunk that needs an Alex conversation before it can proceed — flagged explicitly in `BUILD_PLAN.md`, never guessed past.                                                          |
| **DA review**                | Devil's-advocate review, dispatched from a fresh context, checked against `docs/DA-REVIEW.md` + `docs/CONVENTIONS.md` + `docs/RATIONALIZATIONS.md` + `docs/REVIEW-PATTERNS.md`.     |
| **spec-grill**               | Two-phase adversarial review of a spec/plan/rationale doc before code moves, per `docs/DEVELOPMENT.md` §Two-phase grill discipline.                                                 |
| **copilot-surrogate**        | Factual-claim reviewer, mandatory on `fix(docs)` commits, reading the full PR diff at HEAD (not diff-scoped).                                                                       |
| **Do-not-touch list**        | Surfaces requiring Alex's explicit approval before editing (persona prompts, `docs/CEREMONIES.md`, `docs/VISION.md` §2/§14/§4.1) — `CLAUDE.md` §Non-obvious constraints.            |
| **NOTICED BUT NOT TOUCHING** | The self-review discipline of listing an out-of-scope improvement rather than fixing it inline (`docs/SELF-REVIEW.md`).                                                             |
| **Blast-radius doc**         | A policy-tier doc requiring Alex's merge (not self-merge), listed in `docs/GIT.md`.                                                                                                 |
| **ADR**                      | Architecture Decision Record — the general industry term for a short, dated record of an architectural choice and its rationale. Moe's equivalent shape lives in `docs/decisions/`. |

## Tools & general terms

| Term                    | Definition                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HITL**                | Human-in-the-loop — a step requiring human judgment before proceeding.                                                                                                                              |
| **MCP**                 | Model Context Protocol — Anthropic's protocol for connecting tools to Claude. Per-persona tool allowlists and the CLI-vs-MCP decision rule are specified in `BUILD_PLAN.md` (`docs/VISION.md` §11). |
| **Four-eyes principle** | The general security/engineering practice of requiring two people (or an agent plus a human, or two independent agents) to approve a sensitive action before it takes effect.                       |

## Related docs

- [Architecture](ARCHITECTURE.md) — system architecture and package map
- [Decisions](decisions/) — the "why" behind non-obvious choices
- [VISION](VISION.md) — product vision, ceremonies, the cast
