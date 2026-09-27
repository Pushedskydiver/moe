# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 49)

Updated 2026-09-27 end-Session-49 — **the `getTestPool()` host-guard fix is open as [PR #113](https://github.com/Pushedskydiver/moe/pull/113), not merged (Alex merges).** [PR #112](https://github.com/Pushedskydiver/moe/pull/112) merged 2026-09-27 04:12 UTC with CI green; all 8 personas healthy on the 6.1g image. Alex asked to continue the workflow series starting with this fix; nothing came up that was his to decide.

**Shipped (on #113, unmerged):** `packages/core/src/ticket-lifecycle/test-db.ts` — `getTestPool()` refuses any `DATABASE_URL` whose host, as `pg-connection-string` parses it, isn't exactly `localhost`/`127.0.0.1`, with a fixed error (no URL, host, password or `cause`). It uses pg's own parser because a `?host=` query param overrides the authority host there (see ZZZ). `pg-connection-string@^2.14.0` is now a direct `@moe/core` dependency, and a test pins that it resolves to the same file `pg` does. New `test-db.test.ts` (13 tests, no DB needed); `.claude/agents/implementer.md`'s test-run sentence now calls the guard a backstop. Review: R1 `da-review` 1 MATERIAL (exact-match not pinned) + 3 LOW, `copilot-surrogate` (run alongside R1, mandatory at >50 LOC) 2 LOW → `implementer` fold → R2 DA range check 0 BLOCKING/MATERIAL, 1 LOW → closed by a disclosed orchestrator author-read (efea980). Surrogate findings posted as a PR comment. Quality suite green locally except `packages/core`'s 20 DB-backed files (Docker down, `DATABASE_URL` unset — CI runs them). CI on #113 was 4 passing / 1 pending at handoff.

**Also:** Sessions 44–46 archived into `docs/history/SESSIONS.md` (`45699bc`, direct to main).

**In flight:** nothing running.

**Session data:** ~175k tokens at handoff (usage tool; 5-hour window 32%, weekly 32%). Triggers: phase boundary (PR opened) at 151k, just past the 150k soft line. Most growth: four review/fold reports and the diffs read back to verify them. `implementer` runs: build ~75k subagent tokens, fold ~64k. Structural warning signs: none.

**Lessons (Session 49):**

- **ZZZ — Guard an input with the parser that consumes it.** `pg` resolves `DATABASE_URL` with `pg-connection-string`, where `?host=` overrides the URL's host, so a `new URL().hostname` guard would have been bypassable (`…@localhost/db?host=prod`). Found by reading the library before writing the brief, not in review. A safety check on a string some library interprets must run that library's own parser, and a test should pin that both resolve the same copy.
- **AAAA — `implementer`'s first build under a settled brief: 0 stops, and it verified the brief's claims against source instead of trusting them.** Naming the skipped steps explicitly (XXX's fix) worked — steps 3–4 ran. Running `copilot-surrogate` alongside DA R1 on a small PR cost nothing and saved a round. The R2 DA LOW (PR-local finding IDs in code comments) matched the orchestrator's own self-review before the report arrived — convergence again; a fold brief should say "no review IDs in code comments".

### Session 50 loading instructions

- **Check live state first (the entry is a snapshot):** `git log --oneline -10 origin/main`, `git status`, `gh pr list`, `gh pr view 113 --json state,mergedAt,statusCheckRollup`. If #113 merged: `git checkout main && git pull`, `git branch -d fix/test-pool-host-guard`. If its CI failed, fix that first (the DB-backed core tests run only in CI — a failure there is the first real run of the guard against CI's `localhost` URL). Fleet: `fly status -a moe-<persona>` for sarah, riley, marcus, priya, dom, nia, theo, maya.
- **Primary workstream — the workflow series, in this order:**
  1. **PR 4, rulebook:** `AGENTS.md` as the single rulebook, `CLAUDE.md` → a stub with an `@AGENTS.md` import (YYY in the Session 48 entry); retire `scripts/generate-agents-md.ts`, its CI freshness job and `DEVELOPMENT.md` §AGENTS.md generation (and the `literal`/`source-only` markers, plus `doc-fixer`/`implementer` steps that run `generate:agents-md`); path-scoped `.claude/rules/` for the persona-prompt do-not-touch and Slack/GitHub integration rules (extend `check-agent-frontmatter.ts` to rule files); chief-clancy doc-port paragraph → `docs/decisions/`. Make the rulebook's wording tool-neutral (Codex reads it too).
  2. **PR 3, handoff protocol:** port PCR's `docs/SESSION-HANDOFF.md` (usage tool + CLI fallback, trigger table, cleanup, paste-in prompt, model/effort table, per-session tokens, lettered lessons harvested into `RATIONALIZATIONS.md`/`REVIEW-PATTERNS.md` — WWW–AAAA included); replace `DEVELOPMENT.md` §Session handoff with a pointer.
  3. **PR 5, docs thinning:** `DEVELOPMENT.md` review-gate section and `GLOSSARY.md` via PCR `research/61`'s method, before/after token counts; include #111's deferred stale paragraph about isolated agents `cd`-ing into the primary checkout, `ARCHITECTURE.md`'s `packages/agents` row missing 6.1d–6.1g (`react-tool.ts`, `compose-confirming-question-lead-in.ts`), and `ARCHITECTURE.md:15`'s "orchestrator logic not yet built".
  4. **Hook PR:** `.claude/settings.json` PreToolUse(Bash) making `fly deploy` / `fly secrets` ask.
  - Baselines (tokens): `CLAUDE.md` 4,879; `docs/DEVELOPMENT.md` 16,970 (before #111); `docs/DA-REVIEW.md` 9,703; `docs/SELF-REVIEW.md` 5,314; `docs/GLOSSARY.md` 28,809.
- **Orchestrate:** builds to `implementer`, doc folds to `doc-fixer`, both in the primary checkout with a settled brief written to the scratchpad (name skipped steps; say "no review IDs in code comments"); reviews to the pinned agents with `isolation: 'worktree'` and the primary checkout's path; `copilot-surrogate` may run alongside DA R1 when its trigger fires; check usage after each digested report and before each dispatch; hand off at 150k soft / 250k hard.
- **Measure `chunk-briefer`** on the next real engineering chunk (#113 was too small).
- **Marcus's Plan stall — Alex chose option (a) 2026-09-27:** cancel legacy ticket `5d743b2a-3f5c-4ff7-b272-69dc9a74dd3b`, then verify 6.1e's Plan→Build with a fresh ticket during core hours (Mon–Fri 08:30–17:00 Europe/London). Confirm the moment with Alex; use the ticket-lifecycle transition, not raw SQL.
- **Unchanged:** small fix candidates (`record:replay --` forwarding, `OPERATIONS.md` canary-first deploy, logging successful DM outcomes); engineering candidates 6.2, 6.3a–d, 6.5a–i, 6.6, 6.10 — ask, don't default.
- **Recommended model and effort for Session 50:** Opus, `high`.
- **Decision branches:** ZZZ–AAAA above; WWW–YYY in the Session 48 entry; TTT–VVV in the Session 47 entry; earlier via `git log -p PROGRESS.md`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 48

Updated 2026-09-27 end-Session-48 — **PR 2b of the workflow series is open as [PR #112](https://github.com/Pushedskydiver/moe/pull/112), not merged (Alex merges): the `implementer` and `doc-fixer` Sonnet worker agents.** [PR #111](https://github.com/Pushedskydiver/moe/pull/111) merged 2026-09-27 03:27 UTC with CI green; all 8 personas healthy on the 6.1g image; the merged local branch `docs/prompt-audit-fixes` (#109) was deleted.

**Asked and decided (Alex, 2026-09-27, this session):** (1) **Reorder: PR 4 (rulebook) before PR 3 (handoff protocol)**, so PR 3 edits the single `AGENTS.md` directly instead of the generator about to be retired. Verified against Claude Code's memory docs first: Claude Code reads `AGENTS.md` natively (v2.1.277+) but **only when no `CLAUDE.md` exists** — a `CLAUDE.md` that merely mentions `AGENTS.md` hides it, so the stub must be an `@AGENTS.md` import (PCR's shape); keep the stub rather than delete `CLAUDE.md`, since some sessions (first after an upgrade, `agents-md` plugin disabled) can't read `AGENTS.md` directly. (2) **#112's R4 still found a MATERIAL → Alex chose (via `AskUserQuestion`) to fold, close with a disclosed author-read (no R5), and follow up with a code guard:** `getTestPool()` (`packages/core/src/ticket-lifecycle/test-db.ts`) should refuse any `DATABASE_URL` host other than localhost/127.0.0.1 (CI's is `localhost`, `.github/workflows/ci.yml:41`), so no prompt wording is load-bearing for prod safety.

**Shipped (on #112, unmerged):** `.claude/agents/implementer.md` (build mode + fold mode; branch check; `[GATE]` check; every test run through `env -u DATABASE_URL` unless the brief gives a localhost URL; never pushes/merges/deploys) and `.claude/agents/doc-fixer.md` (applies findings under a settled brief; never commits; branch check); `DEVELOPMENT.md` §Session Pattern "Orchestrate" bullet (no `model` param, primary checkout, never `isolation: 'worktree'`, one worker per checkout); `CLAUDE.md`/`AGENTS.md`, `ARCHITECTURE.md` (tree + corrected `packages/agents` row). Review: R1 DA 6 MATERIAL + surrogate 2 MATERIAL → R2 (surrogate clean, DA 2 MATERIAL from the fold) → R3 DA 1 MATERIAL → R4 DA 1 MATERIAL → Alex's call above. Folds 1–2 by `doc-fixer` (its first real runs: 19 then 8 findings applied, 0 stopped), folds 3–4 by the orchestrator directly. Surrogate findings posted as a PR comment. CI on #112 had not reported at handoff.

**In flight:** nothing running.

**Session data:** ~205k tokens at handoff (usage tool; 5-hour window 27%, weekly 31%). Triggers: phase boundary (PR opened), past the 150k soft line (crossed at the fold-1 dispatch; the PR was finished first). Most growth: six review reports and three fixer reports returning to the main context, plus the reads to settle fold briefs. Structural warning signs: none.

**Lessons (Session 48):**

- **WWW — A safety rule written into one step leaks through the others.** The "don't run tests against a non-local DB" rule was patched four rounds running (R1 which DB, R2 an exported shell value, R3 the `--no-bail` fallback, R4 the TDD step's own test runs) — each fold closed one path and the next check found another. When prose keeps leaking, fix the mechanism (here: a host guard in the helper), not the wording.
- **XXX — A settled brief makes a Sonnet fixer reliable, but brief wording is scope.** `doc-fixer` applied 27 findings across two folds with nothing stopped, verified script names and exports before writing them, and reported the out-of-scope gap instead of inventing text. Its one defect came from the brief: "skip reading beyond what the findings touch" was read as skipping the conventions and do-not-touch steps too. Name the steps a mode skips; never describe them.
- **YYY — Claude Code's native `AGENTS.md` read is conditional.** It happens only when there is no `CLAUDE.md` in the directory tree; otherwise `CLAUDE.md` wins. A redirect has to be `@AGENTS.md`, never a sentence.

## Earlier: Session 47

Updated 2026-09-27 end-Session-47 — **PR 2 of the workflow series is open as [PR #111](https://github.com/Pushedskydiver/moe/pull/111), not merged (Alex merges); it ran the new scoped Round-2 rule on itself and converged at R3.** [PR #110](https://github.com/Pushedskydiver/moe/pull/110) merged 2026-09-27 02:36 UTC.

**Asked and decided (Alex, 2026-09-27, this session):** (1) bring over every PCR agent worth having, adapted — `implementer` and `doc-fixer` now (PR 2b), `chunk-briefer` after measuring one chunk; `doc-checker` only if PR 3 shows a gap `copilot-surrogate` + scoped Round-2 don't cover; not `code-reader`/`lint-fixer` (unused in PCR) or `import-mapper`/`maths-reviewer` (PCR-domain). (2) Carry over PCR's usage-aware handoff: Claude checks context, the 5-hour and weekly limits with the desktop app's usage tool (`mcp__ccd_session_mgmt__get_usage`, confirmed working here), decides when to hand off, does the cleanup, writes the entry, and gives a lean paste-in prompt plus the next session's model and effort — PR 3, now built from PCR's `docs/SESSION-HANDOFF.md` (triggers: phase boundary above 100k, soft 150k, hard 250k, 5-hour window ≥85%, structural warning signs, topic switch). (3) **Adopt PCR's rulebook shape** (Alex: "No — adopt PCR's shape", `AskUserQuestion`): `AGENTS.md` becomes the single rulebook, `CLAUDE.md` a one-line `@AGENTS.md` import; retire `scripts/generate-agents-md.ts`, its marker conventions and CI freshness job (PR 4). (4) Docs optimisation is now agreed, not a candidate (PR 5). (5) Delete `docs/archive-build-narrative` — it was already gone on GitHub (auto-deleted on merge); local ref pruned.

**Shipped (on #111, unmerged):** review agents pin `model: opus` + `effort: high`; `docs/DEVELOPMENT.md` §Review Gate's Round-2 rule is a loop of fresh checks scoped to each fold's commit range (stop at 0 BLOCKING/MATERIAL; the last check's LOWs close in one author-read, disclosed pass; ask Alex if R4 still finds BLOCKING/MATERIAL), with `da-review`/`copilot-surrogate` Round-2 modes and sibling edits (pre-merge checkpoint, `RATIONALIZATIONS.md`, `GLOSSARY.md`, `REVIEW-PATTERNS.md`, the worktree paragraph — isolated worktrees branch from `main`); `scripts/check-agent-frontmatter.ts` (Zod v4, 23 tests incl. a fast-check property) in a new CI job "Agent frontmatter" that also type-checks and tests root `scripts/`. **Verified:** build/lint/typecheck/format/knip and the three new script commands green locally; package tests at baseline (agents 323, server 421, slack 147, github 43, memory 1); `packages/core`'s 20 DB-backed files fail locally (Docker down) — CI runs them. CI on #111 had not reported at handoff. Review trail is in the PR body; surrogate findings posted as a PR comment.

**In flight:** nothing running. All review/fix subagents finished and their output is committed on #111.

**Session data:** ~245k tokens at handoff (usage tool; 5-hour window 20%, weekly 30%). Triggers: phase boundary (PR opened) and hard line (250k) — the 150k soft line was passed at ~180k, mid-PR, and the PR was finished first. Structural warning signs: none. Most growth: review-agent reports (5 reviews + 2 grills) and the fold diffs read back.

**Lessons (Session 47):**

- **TTT — QQQ happened three times in one PR:** the spec-grill fold swapped one false "longest chain" claim for another (5.3g, not 3.12, is moe's longest), and the R1 fold attached `CLAUDE_CODE_SUBAGENT_MODEL` to `inherit` where the docs say it doesn't apply. Scoped range checks caught all three cheaply — evidence the new rule works. Folding a claim: state what the source says, add no superlatives.
- **UUU — A fix that narrows a regex can turn "rejected" into "silently skipped".** Requiring a space after the colon made `effort:hgh` pass instead of fail; the fix is to report unmatched lines, never drop them.
- **VVV — Isolated review worktrees branch from `main`, not the branch under review**, so every review brief must give the primary checkout's path for HEAD reads. All briefs this session did; one reviewer still started from `main` and noticed.

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
