# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 2)

Updated 2026-07-10 end-Session-2 — **Stage 0 is now fully complete.** One continuous session: Alex's first ask was a deep-research test of chief-clancy's "investigated auto-handoff, declined, measure-first" conclusion (cut short mid-verification by a usage limit, but sufficient); the session then continued through chunks 0.6c and 0.7, closing out Stage 0 entirely.

**Auto-handoff research → position**: [PR #9](https://github.com/Pushedskydiver/moe/pull/9), merged — `docs/DEVELOPMENT.md` §Session handoff's placeholder replaced with a researched **decline-with-updated-reasons** position: chief-clancy's conclusion holds, but its tooling-maturity reason is stale on the hook side (the beta label belonged to the Routines substrate, not hooks — `PostCompact` shipped, hooks non-beta, now first-class), while its summary-quality reason has hardened into measured-risky (omission-dominant failure mode, adversarially verified). Chief-clancy's own 40-session audits (read directly) showed 0/40 unplanned compactions and recommended retiring the workstream. Moe adopts event-based revisit triggers instead of imported thresholds. Full provenance: `.claude/research/session-handoff-automation/research-2026-07-09.md` (local-only).

**Chunk 0.6c — reference docs + port decision**: [PR #10](https://github.com/Pushedskydiver/moe/pull/10), merged — added `docs/ARCHITECTURE.md` + `docs/GLOSSARY.md` (written fresh, not templated off chief-clancy's mature versions) and ported chief-clancy's `docs/decisions/` lifecycle convention with one real seed doc (`SESSION-HANDOFF-AUTOMATION.md`). Resolved `CLAUDE.md`'s doc-port open question: defer chief-clancy's LIFECYCLE/TECHNICAL-REFERENCE/VISUAL-ARCHITECTURE/COMPARISON/guides/roles, each with a stated re-entry condition. Review found 13 real issues (2 fabricated `CLAUDE.md §Status` citations, a missing glossary Tier 0 row, a dangling citation to nonexistent content — fixed by writing the content for real) — all folded, DA R2-confirmed, which itself caught a sibling copy of the same factual error in this very file.

**Chunk 0.7 — generate:agents-md TS port + CI check**: [PR #11](https://github.com/Pushedskydiver/moe/pull/11), merged — ported the interim Python generator to `scripts/generate-agents-md.ts` (`pnpm generate:agents-md`, runs natively on Node 24, no tsx/ts-node), added a real `AGENTS.md freshness` CI job **now wired into `main`'s required branch-protection checks** (it wasn't at PR-open time — a real gap the PR itself surfaced, closed same-day via the same `gh api` mechanism chunk 0.4 used). Review found CLAUDE.md falsely claiming chunk-0 "fully complete" while BUILD_PLAN's own checkbox was still in-progress, plus a stale reference to the just-deleted `.py` file — both folded, DA R2-confirmed clean.

**Major novel patterns this session:**

1. **Primary sources beat ported summaries (n=2 now).** Moe's placeholder said chief-clancy's thresholds were "calibrated against years of session history" — the real audits showed something different and better-founded. The same class of error (a factual claim copied into a sibling file without a full sweep) recurred in chunk 0.6c's own fold. Cross-doc consistency sweeps need to check every location a fact appears, not just the file under active edit.
2. **Review-agent isolation matters.** A DA dispatch without `isolation: 'worktree'` ran exploratory git commands in the shared working directory and left a stray branch checked out afterward — no data lost (everything was already committed/pushed, caught immediately via `git status`/reflog), but real. Since then: dispatch review/exploration subagents with `isolation: 'worktree'` whenever they'll run git commands beyond reading.
3. **An unenforced CI check achieves nothing beyond visibility.** Chunk 0.7 added a freshness-check CI job but initially left it out of required branch protection — CLAUDE.md's own "closes the gap" claim was briefly false until the required-checks list was actually updated. Adding a check and requiring it are two different actions; both are needed for the claim to be true.
4. **Session-limit failures are survivable mid-workflow** — the deep-research run lost 51/103 agents to a usage limit but the surviving claims plus a first-party source read were enough to reach a confident position. Read cheap primary sources before an expensive fan-out; they often carry more weight than the web sweep.

**Earlier Session 1 status, compressed** — first working session of the v3 rebuild: repo bootstrap through Stage-0 process docs, chunks 0.1–0.6b shipped 2026-07-04–07-09 ([#1](https://github.com/Pushedskydiver/moe/pull/1)–[#8](https://github.com/Pushedskydiver/moe/pull/8)). Durable patterns: Volta/pnpm Node-24 PATH gotcha (now documented for real at `docs/DEVELOPMENT.md` §Local dev environment, no longer memory-only); fixture-testing catches silently-inert config; `CLAUDE.md` status framing needs truing up in every chunk's own PR; a stated intention needs the same verification as any other claim.

### Session 3 loading instructions

- **Verify state before picking anything up:** `git log --oneline -5` (expect PR #11's squash `431849c` at HEAD), `git status` clean on `main`. `BUILD_PLAN.md` shows `0.1`–`0.6c` `[x]` and **`0.7` still `[~]`** — chunk 0.7 is merged and code-complete (PR #11), but per this project's own precedent (checkbox flips bundle into the _next_ chunk's PR, never a standalone checkbox-only PR — see 0.6b's/0.6c's own flips), 0.7's flip to `[x]` is chunk 1.1's first edit, not something already done. **Stage 0 is otherwise fully done — this is a real stage boundary, not just a chunk boundary.**
- **Primary workstream — BUILD_PLAN Stage 1, chunk 1.1:** "Ticket types + Zod schemas" — `Ticket`, board statuses (`Backlog → Brief → Plan → Build → Review → Done` + `Cancelled`), severity classes, `projectKey`. Pure types + schemas + unit tests, no DB yet. Not `[GATE]`. Flip `0.7`→`[x]` as this PR's first edit (verify PR #11's content on `main` first, don't trust this note alone). Same rules of engagement: one chunk = one PR, full review gate (DA + copilot-surrogate, dispatch with `isolation: 'worktree'` if they'll run git commands), docs win on conflict, surface contradictions.
- **Decision branches:**
  - A. Stage 1's exit criterion (two concurrent fake persona processes race to claim a ticket; exactly one wins, every status message carries evidence) isn't met until chunk 1.3 (atomic claim) — 1.1/1.2a/1.2b/1.3 are the load-bearing sequence, don't skip ahead.
  - B. **1.2a is `[GATE]` — now decided (2026-07-11), pending merge.** N machines (one per persona) + Neon Postgres, reversing the original single-machine/SQLite framing on evidence (an ongoing Litestream silent-failure bug pattern; real host-level incident cadence; a narrower cost gap than assumed). Full reasoning: `docs/decisions/TOPOLOGY-AND-DATABASE.md`. If this note is stale (still describing an open question after the ADR's own PR has merged), trust `BUILD_PLAN.md`'s checkboxes over this file.
  - C. **1.5 is also `[GATE]`** — track-record definition ADR (VISION §8.1's open question: multi-directory diffs, renames, new directories, threshold N). Blocks 1.6, may float later than Stage 1, but must land before Stage 5's first 5.3 sub-chunk.
  - D. If Alex flags the `scripts/*.ts` eslint-scope question from chunk 0.7's PR (should the strict ruleset extend beyond `packages/*/src`+`apps/*/src`?), that's a `docs/CONVENTIONS.md`/`eslint.config.ts` decision — apply it before writing 1.1's own Zod schemas if it lands first.
- **Carry-overs:**
  - Branch protection now requires **three** checks: "Quality suite", "Validate PR title format", "AGENTS.md freshness" (the third added 2026-07-10). Squash-only, `delete_branch_on_merge` on. After a merge: `git checkout main && git pull && git branch -d <branch>`.
  - Node-24 `PATH` prepend in every Bash call that needs pnpm — now documented for real at `docs/DEVELOPMENT.md` §Local dev environment (not just memory).
  - `AGENTS.md` regenerates via `pnpm generate:agents-md` + `pnpm format` after any `CLAUDE.md` edit — CI now enforces this, don't rely on remembering.
  - Event-based handoff revisit triggers are live policy (`docs/DEVELOPMENT.md` §Session handoff) — record a firing here if one happens.
  - Dispatch review/exploration subagents with `isolation: 'worktree'` when they'll run git commands beyond plain reads.
- **Fallback:** if Alex redirects on load, follow that; otherwise default to the primary workstream above.

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

| Chunk | Status | Shipped    | Headline                                                                                         |
| ----- | ------ | ---------- | ------------------------------------------------------------------------------------------------ |
| 0.1   | Merged | 2026-07-04 | git init + pnpm workspace skeleton, `packages/core` toolchain proven                             |
| 0.2   | Merged | 2026-07-04 | ESLint/Prettier/knip/husky, 6 rule-family fixtures verified then deleted                         |
| 0.3   | Merged | 2026-07-04 | Package graph settled, `eslint-plugin-boundaries` wired (needed a resolver fix)                  |
| 0.4   | Merged | 2026-07-04 | CI pipeline + branch protection live                                                             |
| 0.5   | Merged | 2026-07-04 | Review-gate agents ported, dogfooded, caught real `CLAUDE.md` drift                              |
| 0.6a  | Merged | 2026-07-04 | Process docs (`docs/DEVELOPMENT.md`, `docs/TESTING.md`) + `PROGRESS.md`/`SESSIONS.md` resolved   |
| 0.6b  | Merged | 2026-07-09 | Review canon (`docs/RATIONALIZATIONS.md`, `docs/REVIEW-PATTERNS.md` pre-seeded per VISION §12)   |
| 0.6c  | Merged | 2026-07-10 | Reference docs (`ARCHITECTURE.md`, `GLOSSARY.md`, `decisions/`) + chief-clancy doc-port decision |
| 0.7   | Merged | 2026-07-10 | `generate:agents-md` TS port + CI freshness check (now required) — **Stage 0 complete**          |
