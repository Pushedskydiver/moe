---
status: Decided
date: 2026-07-09
---

# Chief-Clancy Doc Ports

## Decision

Chief-clancy also has `docs/LIFECYCLE.md`, `docs/TECHNICAL-REFERENCE.md`, `docs/VISUAL-ARCHITECTURE.md`, `docs/COMPARISON.md`, `docs/guides/` (`CONFIGURATION.md`, `SECURITY.md`, `TROUBLESHOOTING.md`), and `docs/roles/` (`IMPLEMENTER.md`, `PLANNER.md`, `REVIEWER.md`, `SETUP.md`, `STRATEGIST.md`). **Moe defers all of them; none are rejected outright.** Each assumes a mature, deployed product (a real installer, board integration, live personas with pipeline mechanics) moe doesn't have yet at Stage 0.

## Context

Settled at BUILD_PLAN chunk 0.6c. Moved out of `CLAUDE.md` in the single-rulebook change (2026-09-27) — this doc is that paragraph, restructured, unchanged in substance.

## Re-entry conditions

- **`LIFECYCLE.md`, `VISUAL-ARCHITECTURE.md`** — once moe has real personas and a working ticket pipeline to describe/diagram (Stage 4+).
- **`guides/`** — once moe ships an installable/configurable deployed surface.
- **`roles/`** — once moe's own personas exist (`packages/agents` past scaffold) — worth adopting its one-file-per-role convention then.
- **`TECHNICAL-REFERENCE.md`, `COMPARISON.md`** — no near-term moe equivalent (deep multi-package reference and competitive positioning, respectively) and aren't expected to be revisited on any specific trigger.

`BUILD_PLAN.md`'s "Deliberately not scheduled" section carries these same re-entry conditions.
