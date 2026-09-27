# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 50)

Updated 2026-09-27 end-Session-50 — **PR 4 of the workflow series (single rulebook) is built and pushed as branch `chore/single-rulebook` (`ffdc9e6`), not yet reviewed and no PR opened.** [PR #113](https://github.com/Pushedskydiver/moe/pull/113) merged 2026-09-27 04:42 UTC with CI green; all 8 personas `started` with checks passing on the same image. Its remote branch was deleted.

**Asked and decided (Alex, 2026-09-27, this session):** the generator's CI job "AGENTS.md freshness" is a **required** check on `main` (with `strict: true`). Alex chose (`AskUserQuestion`) to **swap it for "Agent frontmatter"**: the PR deletes the freshness job and adds `pnpm check:rulebook` to the "Agent frontmatter" job, whose name stays unchanged. **Alex must make the swap in branch protection _before_ merging.** The old check will never report, so the PR can't merge until the swap is done. Also: Alex logged the `fly` CLI back in mid-session (it had reported `no access token available`).

**Shipped (on the branch, unreviewed):** `AGENTS.md` is now the single rulebook (11,366 B; generator markers are gone, the wording is tool-neutral, and "see project memory" became `docs/GIT.md` §Deploy Flow). `CLAUDE.md` is a stub: a heading, one sentence and `@AGENTS.md`. There are two path-scoped rules, `.claude/rules/persona-prompts.md` and `.claude/rules/integrations.md`. `.gitignore` now un-ignores `.claude/rules/`. There are two new decision docs, `SINGLE-RULEBOOK.md` and `CHIEF-CLANCY-DOC-PORTS.md`, both indexed in the README. New `scripts/check-rulebook.ts` with 25 tests covers the stub's import line (outside any fence), rule-file `paths:` entries (quoted only, no `[`) and globs that must match git-tracked files. `generate-agents-md.ts`, the npm script and the CI job are retired. `docs/GIT.md`'s required-checks sentence now names the three post-swap checks. `CLAUDE.md` citations were repointed across `docs/`, both worker agents and 4 TSDoc comments. The diff is 31 files, +614/−269.

- **Process so far:** the brief went through spec-grill R1: 1 BLOCKING (`.gitignore` hid `.claude/rules/`), 3 MATERIAL, 8 LOW. All were folded into the brief, with **no verification-round grill** — disclose that in the PR; DA R1 covers the implemented result. `implementer` then built it: 0 stops, ~219k subagent tokens. Locally green except `packages/core`'s DB-backed files (no `DATABASE_URL`).
- **Brief** (for reviewers): `.claude/research/workflow-series/pr4-brief.md` (gitignored, local only).

**Session data:** ~145k tokens at handoff (usage tool; 5-hour window 5%, weekly 32%). Trigger: phase boundary (build done) above 100k, near the 150k soft line. Most growth: the grill report and the brief. Structural warning signs: none.

**Lessons (Session 50):**

- **BBBB — Grill the brief, and check `.gitignore` for any new directory under a partly-ignored parent.** `.claude/*` is ignored except `agents/`, so the rule files would have passed `check:rulebook` locally (it reads the disk), never been committed, and failed only in CI. Only the spec-grill on the brief caught it. A brief that creates a directory should include `git check-ignore -v <new path>`.
- **CCCC — A PR that deletes the job behind a required check is unmergeable until the settings change.** Put that settings step in the PR body as a _pre_-merge action, and update the doc that lists required checks (`docs/GIT.md`, which was already stale at two checks).

### Session 51 loading instructions

- **Check live state first:** `git log --oneline -5 origin/main`, `git status`, `gh pr list`, `git log --oneline -2 origin/chore/single-rulebook` (expect `ffdc9e6`). Fleet: `fly status -a moe-<persona>` for all 8 (run outside the sandbox if it reports no token; if it's genuinely logged out, ask Alex to run `fly auth login`).
- **First: finish PR 4's review gate** on `chore/single-rulebook`, in order: architectural → DA R1 (`da-review`) with `copilot-surrogate` alongside (mandatory: blast-radius docs and >50 LOC; 31 files is over its 20-file ceiling, so split it by logical group — rulebook + stub + rules + decisions; scripts + CI + package.json + `.gitignore`; repointed docs + agents + TSDoc) → fold (code findings to `implementer`, doc findings to `doc-fixer`) → scoped R2 → self-review → open the PR (`📦 chore: make AGENTS.md the single rulebook, retire the generator`). **The PR body must carry:** the pre-merge settings step for Alex (in main's required checks, remove "AGENTS.md freshness" and add "Agent frontmatter"); the disclosure that the grill fold had no verification round; that the check is a separate `check-rulebook.ts`, not an extension of `check-agent-frontmatter.ts` (orchestrator's call); and before/after always-loaded size (`CLAUDE.md` 12,499 B before → stub + `AGENTS.md` ≈ 11.6 KB after; measure in tokens).
- **Then the rest of the workflow series, in order:** PR 3 (handoff protocol — port PCR's `docs/SESSION-HANDOFF.md`, harvest lettered lessons WWW–CCCC into `RATIONALIZATIONS.md`/`REVIEW-PATTERNS.md`, replace `DEVELOPMENT.md` §Session handoff with a pointer); PR 5 (docs thinning — `DEVELOPMENT.md` review gate, `GLOSSARY.md`, #111's stale isolated-agent paragraph, `ARCHITECTURE.md`'s `packages/agents` row and line 15, and `docs/VISION.md:327`'s now-dated `AGENTS.md`↔`CLAUDE.md` drift line — VISION edit, ask Alex); Hook PR (`fly deploy`/`fly secrets` ask).
- **Orchestrate / thresholds / Marcus's Plan stall / candidates / chunk-briefer:** unchanged from the Session 50 loading instructions (in `git log -p PROGRESS.md`): workers in the primary checkout with a scratchpad brief, reviews in `isolation: 'worktree'`, check usage after each digested report and before each dispatch, hand off at 150k soft / 250k hard. Marcus: cancel legacy ticket `5d743b2a-3f5c-4ff7-b272-69dc9a74dd3b`, then verify Plan→Build with a fresh ticket in core hours (Mon–Fri 08:30–17:00 Europe/London) — confirm the moment with Alex.
- **Recommended model and effort for Session 51:** Opus, `high`.
- **Decision branches:** BBBB–CCCC above; ZZZ–AAAA in the Session 49 entry; WWW–YYY in the Session 48 entry; earlier via `git log -p PROGRESS.md`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 49

Updated 2026-09-27 end-Session-49 — **the `getTestPool()` host-guard fix is open as [PR #113](https://github.com/Pushedskydiver/moe/pull/113), not merged (Alex merges).** [PR #112](https://github.com/Pushedskydiver/moe/pull/112) merged 2026-09-27 04:12 UTC with CI green; all 8 personas healthy on the 6.1g image. Alex asked to continue the workflow series starting with this fix; nothing came up that was his to decide.

**Shipped (on #113, unmerged):** `packages/core/src/ticket-lifecycle/test-db.ts` — `getTestPool()` refuses any `DATABASE_URL` whose host, as `pg-connection-string` parses it, isn't exactly `localhost`/`127.0.0.1`, with a fixed error (no URL, host, password or `cause`). It uses pg's own parser because a `?host=` query param overrides the authority host there (see ZZZ). `pg-connection-string@^2.14.0` is now a direct `@moe/core` dependency, and a test pins that it resolves to the same file `pg` does. New `test-db.test.ts` (13 tests, no DB needed); `.claude/agents/implementer.md`'s test-run sentence now calls the guard a backstop. Review: R1 `da-review` 1 MATERIAL (exact-match not pinned) + 3 LOW, `copilot-surrogate` (run alongside R1, mandatory at >50 LOC) 2 LOW → `implementer` fold → R2 DA range check 0 BLOCKING/MATERIAL, 1 LOW → closed by a disclosed orchestrator author-read (efea980). Surrogate findings posted as a PR comment. Quality suite green locally except `packages/core`'s 20 DB-backed files (Docker down, `DATABASE_URL` unset — CI runs them). CI on #113 was 4 passing / 1 pending at handoff.

**Also:** Sessions 44–46 archived into `docs/history/SESSIONS.md` (`45699bc`, direct to main).

**In flight:** nothing running.

**Session data:** ~175k tokens at handoff (usage tool; 5-hour window 32%, weekly 32%). Triggers: phase boundary (PR opened) at 151k, just past the 150k soft line. Most growth: four review/fold reports and the diffs read back to verify them. `implementer` runs: build ~75k subagent tokens, fold ~64k. Structural warning signs: none.

**Lessons (Session 49):**

- **ZZZ — Guard an input with the parser that consumes it.** `pg` resolves `DATABASE_URL` with `pg-connection-string`, where `?host=` overrides the URL's host, so a `new URL().hostname` guard would have been bypassable (`…@localhost/db?host=prod`). Found by reading the library before writing the brief, not in review. A safety check on a string some library interprets must run that library's own parser, and a test should pin that both resolve the same copy.
- **AAAA — `implementer`'s first build under a settled brief: 0 stops, and it verified the brief's claims against source instead of trusting them.** Naming the skipped steps explicitly (XXX's fix) worked — steps 3–4 ran. Running `copilot-surrogate` alongside DA R1 on a small PR cost nothing and saved a round. The R2 DA LOW (PR-local finding IDs in code comments) matched the orchestrator's own self-review before the report arrived — convergence again; a fold brief should say "no review IDs in code comments".

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
