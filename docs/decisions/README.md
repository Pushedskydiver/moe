# Decision Documents

Design decisions for moe — the "why" behind non-obvious choices. The code (and moe's other `docs/*.md`) is the source of truth for "what" and "how."

Adapted from chief-clancy's own `docs/decisions/README.md` — the naming rule carries over unchanged; the lifecycle convention carries over extended with an explicit Status-update-append step (below); the document table is moe's own.

## What belongs here

- **Briefs** — problem statement, success criteria, scope boundaries.
- **Design docs** — architecture decisions, trade-offs, key choices, positions considered and rejected.

## Lifecycle

1. **Before building:** create a brief and/or design doc.
2. **During building:** reference it.
3. **After shipping:** trim to decisions-only (~50 lines each). Append a dated "Status update" section for later developments rather than rewriting history; don't delete the original context.

## Current documents

Decision docs live at `docs/decisions/*.md` (ALLCAPS + flat, matching the top-level `docs/*.md` convention; `README.md` is the standard-casing exception).

| Document                        | Purpose                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION-HANDOFF-AUTOMATION.md` | Whether to automate cross-session handoff; positions considered; why manual stays primary; revisit triggers                     |
| `TOPOLOGY-AND-DATABASE.md`      | Process topology (N machines, one per persona) × DB choice (Neon Postgres); rejected alternatives; evidence                     |
| `TRACK-RECORD-DEFINITION.md`    | Track record for multi-directory diffs (minimum), renames (preserved), new directories (no transfer); N = 5                     |
| `CAST-ROSTER.md`                | Cast redline: keep the 7-role roster, defer Designer, confirm Sarah first; research-backed                                      |
| `REVIEW-GATE-DISCRETION.md`     | Narrow `copilot-surrogate`'s discretionary trigger to mandatory; decline a gate-checker subagent for now                        |
| `STAGE-1-CLASSIFIER.md`         | Stage-1 classifier scoring method (bundled structured-output call, no log-probs/prefill) + High/Mid/Low thresholds; eval-backed |

Other significant decisions already made this early (the package graph settled at chunk 0.3; the Messages-API-vs-Agent-SDK model-client choice) are documented in their original locations — `docs/CONVENTIONS.md` §Architecture Enforcement and `docs/VISION.md` §11, respectively — and aren't duplicated here. Backfilling them is optional, not required by this convention.

## Related docs

- [Architecture](../ARCHITECTURE.md) — system architecture and package map
- [Glossary](../GLOSSARY.md) — terminology
- [VISION](../VISION.md) — product vision, ceremonies, the cast
