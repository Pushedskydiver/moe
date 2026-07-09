# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 2)

Updated 2026-07-09 end-Session-2 — **the auto-handoff research session, cut short by the usage limit.** Alex asked for Session 2's first task (before any BUILD_PLAN chunk) to be a deep-research test of chief-clancy's "investigated auto-handoff, declined, measure-first" conclusion, written into `docs/DEVELOPMENT.md` as a reasoned position; chunk 0.6c was to follow but did not start — the research consumed the remaining session budget.

**Auto-handoff research → position**: [📝 docs(development): adopt researched session-handoff automation position](https://github.com/Pushedskydiver/moe/pull/9) — `docs/DEVELOPMENT.md` §Session handoff's placeholder replaced with a researched **decline-with-updated-reasons** position: chief-clancy's conclusion holds, but one of its two stated reasons ("beta-status hook tooling") is stale — `PostCompact` shipped and hooks are no longer beta-labeled — while the other ("unproven summary quality") has hardened into measured-risky (omission-dominant failure mode, adversarially verified lossiness evidence). Chief-clancy's own 40-session audits (read directly from their `.claude/research/session-handoff/`) showed 0/40 unplanned compactions and a cost driver (information density) automation can't reduce; their final audit recommended retiring the workstream. Moe adopts event-based revisit triggers instead of imported numeric thresholds (their thresholds drifted; their per-session measurement collapsed — 19/20 fields TBD). Full provenance: `.claude/research/session-handoff-automation/research-2026-07-09.md` (local-only).

**Major novel patterns Session 2:**

1. **Primary sources beat ported summaries (n=1, material).** Moe's placeholder said chief-clancy's thresholds were "calibrated against years of session history" — the actual audits show they were set in April 2026 against 10-session windows and drifted out of meaning within 20 sessions. Reading the source documents changed the position's shape. Same lesson-class as the VISION-is-north-star rule, applied to cross-repo doc ports.
2. **The deep-research workflow died mid-verification on the session usage limit** (51 of 103 agents failed, including the synthesis step) — the run still yielded 6 adversarially-confirmed claims + 17 consistent-but-unverified ones, which combined with the first-party audit reading was enough. Lesson: read the cheap primary sources _before_ launching the expensive fan-out; they carried more weight than the web sweep.
3. **Session-limit failures surface in subagent errors while the main loop keeps working** — plan for degraded finish (open the PR, document what's pending) rather than assuming a hard stop.

**Earlier Session 1 status preserved below for context** — first working session of the v3 rebuild: repo bootstrap through Stage-0 process docs, chunks 0.1–0.6b all shipped and merged same-day 2026-07-04 ([#1](https://github.com/Pushedskydiver/moe/pull/1)–[#7](https://github.com/Pushedskydiver/moe/pull/7), handoff [#8](https://github.com/Pushedskydiver/moe/pull/8)); per-chunk detail lives in the Phase ledger below and each PR's description. Durable Session-1 patterns, compressed: (1) Volta/pnpm Node-24 gotcha — prepend nvm's v24 bin to `PATH` in every Bash call that needs pnpm; (2) fixture-testing catches silently-inert config (n=2: ESLint rule families, boundaries resolver); (3) `CLAUDE.md` status framing needs truing up in every chunk's own PR (drifted 3 chunks before a review agent caught it); (4) newly-created `.claude/agents/*.md` aren't dispatchable the same session they're written; (5) repo settings needed fixing (squash-only, `delete_branch_on_merge`) not just documenting; (6) a stated intention needs the same verification as any other claim ("marking 0.5 merged" never actually flipped the checkbox); (7) handoff triggered on its own textbook condition and was dogfooded live.

### Session 3 loading instructions

- **Verify state before picking anything up:** `git log --oneline -5` (expect PR #9's squash at or near HEAD), `BUILD_PLAN.md` shows 0.1–0.6b `[x]` / 0.6c–0.7 `[ ]`, `git status` clean on `main`.
- **If PR #9 is still open:** it's the Session-2 research position (docs-only). Check its review state — if the DA/copilot-surrogate pass is recorded as pending in the PR body due to the Session-2 usage limit, dispatch it before anything else, fold findings, then leave the merge to Alex.
- **Primary workstream — BUILD_PLAN chunk 0.6c:** reference docs + port decision (`docs/ARCHITECTURE.md`, `docs/GLOSSARY.md`, `docs/decisions/` with README; decide which of chief-clancy's parked docs moe ports, per `CLAUDE.md`'s list). Same rules of engagement: one chunk = one PR, full review gate, docs win on conflict, surface contradictions.
- **Decision branches:**
  - A. The research position (PR #9) names a deterministic pointer-injection hook as the preferred _candidate_ if a revisit trigger ever fires — it is deliberately NOT a BUILD_PLAN item yet. Only add it if Alex asks for the cheap backstop now.
  - B. If Alex has feedback on the position itself, fold it in PR #9 before merge rather than a follow-up PR.
  - C. 0.7 (`generate:agents-md` TS port + CI freshness check) remains after 0.6c. Neither is `[GATE]`.
- **Carry-overs:**
  - Branch protection requires "Quality suite" + "Validate PR title format"; squash-only; `delete_branch_on_merge` on. After a merge: `git checkout main && git pull && git branch -d <branch>`.
  - Node-24 `PATH` prepend in every Bash call that needs pnpm; never attempt a direct-to-main push.
  - Event-based handoff revisit triggers are now live policy (`docs/DEVELOPMENT.md` §Session handoff) — if an unplanned compaction costs state or a cold-load fails, record it in this file when it happens.
  - First `[GATE]` chunk is 1.2a (topology × DB) — still several chunks away.
- **Fallback:** if Alex redirects on load, follow that; otherwise default to the primary workstream above.

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

| Chunk | Status | Shipped    | Headline                                                                                       |
| ----- | ------ | ---------- | ---------------------------------------------------------------------------------------------- |
| 0.1   | Merged | 2026-07-04 | git init + pnpm workspace skeleton, `packages/core` toolchain proven                           |
| 0.2   | Merged | 2026-07-04 | ESLint/Prettier/knip/husky, 6 rule-family fixtures verified then deleted                       |
| 0.3   | Merged | 2026-07-04 | Package graph settled, `eslint-plugin-boundaries` wired (needed a resolver fix)                |
| 0.4   | Merged | 2026-07-04 | CI pipeline + branch protection live                                                           |
| 0.5   | Merged | 2026-07-04 | Review-gate agents ported, dogfooded, caught real `CLAUDE.md` drift                            |
| 0.6a  | Merged | 2026-07-04 | Process docs (`docs/DEVELOPMENT.md`, `docs/TESTING.md`) + `PROGRESS.md`/`SESSIONS.md` resolved |
| 0.6b  | Merged | 2026-07-04 | Review canon (`docs/RATIONALIZATIONS.md`, `docs/REVIEW-PATTERNS.md` pre-seeded per VISION §12) |
