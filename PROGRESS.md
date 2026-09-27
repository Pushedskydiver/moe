# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 51)

Updated 2026-09-27 end-Session-51 — **PR 4 (single rulebook) finished R1 review and its fold; the branch `chore/single-rulebook` is pushed at `c173da7`. No PR is open yet, and the scoped R2 is the next step.** Main is unchanged (`c21d48c`), and all 8 personas are `started` with checks passing.

**Done this session:**

- **Architectural pass:** passed. There is no package-graph change, `check-rulebook.ts` reuses `extractFrontmatter`, and the full do-not-touch list stays in `AGENTS.md`.
- **R1 (`ffdc9e6`):** `da-review` returned 1 MATERIAL (the empty-`paths:` guard had no test) and 8 LOW. `copilot-surrogate` ran in 3 groups:
  - A (rulebook, stub, rules, decisions): 1 MATERIAL (`SINGLE-RULEBOOK.md:14`'s stub-shape reasoning didn't follow) and 6 LOW.
  - B (scripts, CI, `.gitignore`): 1 MATERIAL (a comment claimed Claude Code only imports `@` at column 0, which is false) and 5 LOW.
  - C (repointed docs): 1 MATERIAL (`DA-REVIEW.md:96` quoted text that doesn't exist) and 16 LOW; C13–C17 are older drift that this PR didn't cause.
- **Reviewer disagreement, resolved by the primary source:** DA confirmed "the first session after an upgrade can't read `AGENTS.md`", and surrogate A4 called it unverified. code.claude.com/docs/en/memory §"When AGENTS.md support is unavailable" confirms it (upgrades from v2.1.276 or earlier, in some cases). **Say this in the PR body.**
- **Fold:**
  - `7b66d57`: `implementer` did scripts and `ci.yml`. The stub's fence _tracking_ became fence _rejection_, stubs with CRLF endings get an explicit error, the comments were reworded, and 31 rulebook tests / 54 script tests pass.
  - `c173da7`: `doc-fixer` did 19 doc items across 14 files.
  - `ffdc9e6..c173da7`: 17 files, +119/−55.
- **Deferred with reasons (list them in the PR body):**
  - A6: `CHIEF-CLANCY-DOC-PORTS.md`'s `roles/` and Stage-4 re-entry conditions look met. Re-opening that deferral is **Alex's call**, so ask him.
  - C12: `CAST-ROSTER.md:14` "CLAUDE.md's do-not-touch list" is dated decision prose.
  - C15: `OPERATIONS.md:229` cites a precedent that doesn't exist; it's older drift.
  - C17: `TOOL-ALLOWLIST-GRID.md:85`'s OWASP LLM06 link text doesn't match its slug; this needs an external check.
  - DA FYI: in worktree sessions, the parent checkout's stub `@AGENTS.md` may count as an "external" import. Not verified live.
- **Always-loaded size, measured:** one-shot `claude -p` in neutral worktrees, two runs each, minus a baseline with neither file present. **~5,030 tokens before → ~4,750 after (−280, ~6%)** for `CLAUDE.md` 12,499 B → stub 207 B + `AGENTS.md` 11,366 B at `ffdc9e6`. The fold changed `AGENTS.md` slightly, so re-measure only if the PR body needs exact numbers.
- **Local copies of all R1 reports and both fold briefs:** `.claude/research/workflow-series/pr4-r1/` (gitignored). **Post the three surrogate reports (`surrogate-A/B/C.md`) as a PR comment once the PR exists. The DA report stays in chat only.**

**Session data:** ~150k tokens at handoff (usage tool; 5-hour window 13%, weekly 34%). Trigger: the 150k soft line, reached at a phase boundary (the R1 fold was committed). What grew context most: four R1 reports (~5k each) and the token measurement. Structural warning signs: none.

**Lessons (Session 51):**

- **DDDD — Subagent hand-back reports aren't in the transcript's text blocks.** To save a report verbatim for a PR comment, extract the longest string from the `*andback*` tool_use input in the task's `.output` JSONL. `.claude/research/workflow-series/pr4-r1/extract-handback.py <task.output> <out.md>` does it. Don't retype a report.
- **EEEE — Measuring always-loaded tokens needs neutral paths.** `claude -p` in the primary checkout also loads the path-keyed auto-memory, which confounds a before/after comparison. Run both sides in scratch worktrees and subtract a no-rulebook baseline.

### Session 52 loading instructions

- **Check live state first:** `git log --oneline -3 origin/main` (expect this handoff on `c21d48c`), `git status`, `gh pr list`, `git log --oneline -3 origin/chore/single-rulebook` (expect `c173da7`). Check fly status for all 8 persona Apps (`moe-sarah`, `-riley`, `-marcus`, `-priya`, `-dom`, `-theo`, `-nia`, `-maya`).
- **First: R2 on PR 4, scoped to `ffdc9e6..c173da7`.** Run it in `isolation: 'worktree'` and tell each reviewer to read the primary checkout's absolute path, which must have the branch checked out.
  - Dispatch `da-review`, with the R1 finding list from `pr4-r1/da-r1.md`.
  - Dispatch `copilot-surrogate` (17 files, under the ceiling), with the A/B/C lists.
  - Each brief asks the reviewer to confirm or disprove each fold, find anything the fold introduced, and grep for sibling copies of corrected wording.
  - Loop until 0 BLOCKING/MATERIAL, and ask Alex at R4. Then close the LOWs, walk self-review, open the PR (`📦 chore: make AGENTS.md the single rulebook, retire the generator`, label `chore` or per `docs/GIT.md` §Labels), and post the surrogate comment.
  - **The PR body must carry:**
    - Alex's pre-merge settings step: in `main`'s required checks, remove "AGENTS.md freshness" and add "Agent frontmatter".
    - The grill fold had no verification round.
    - `check-rulebook.ts` is a separate script (the orchestrator's call).
    - The token measurement above.
    - The reviewer disagreement and how it was resolved.
    - The deferred list, with A6 as a question for Alex.
    - The pre-merge checkpoint.
- **Then, as before:** PR 3 (handoff protocol), PR 5 (docs thinning, plus the VISION:327 edit, which is Alex's call), then the Hook PR. See the Session 50 loading instructions in `git log -p PROGRESS.md` for scope, orchestration, thresholds and the Marcus Plan-stall note.
- **Recommended model and effort for Session 52:** Opus, `high`.
- **Decision branches:** DDDD–EEEE above, BBBB–CCCC in the Session 50 entry, and earlier ones via `git log -p PROGRESS.md`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 50

Updated 2026-09-27 end-Session-50 — **PR 4 of the workflow series (single rulebook) is built and pushed as branch `chore/single-rulebook` (`ffdc9e6`), not yet reviewed and no PR opened.** [PR #113](https://github.com/Pushedskydiver/moe/pull/113) merged 2026-09-27 04:42 UTC with CI green; all 8 personas `started` with checks passing on the same image. Its remote branch was deleted.

**Asked and decided (Alex, 2026-09-27, this session):** the generator's CI job "AGENTS.md freshness" is a **required** check on `main` (with `strict: true`). Alex chose (`AskUserQuestion`) to **swap it for "Agent frontmatter"**: the PR deletes the freshness job and adds `pnpm check:rulebook` to the "Agent frontmatter" job, whose name stays unchanged. **Alex must make the swap in branch protection _before_ merging.** The old check will never report, so the PR can't merge until the swap is done. Also: Alex logged the `fly` CLI back in mid-session (it had reported `no access token available`).

**Shipped (on the branch, unreviewed):** `AGENTS.md` is now the single rulebook (11,366 B; generator markers are gone, the wording is tool-neutral, and "see project memory" became `docs/GIT.md` §Deploy Flow). `CLAUDE.md` is a stub: a heading, one sentence and `@AGENTS.md`. There are two path-scoped rules, `.claude/rules/persona-prompts.md` and `.claude/rules/integrations.md`. `.gitignore` now un-ignores `.claude/rules/`. There are two new decision docs, `SINGLE-RULEBOOK.md` and `CHIEF-CLANCY-DOC-PORTS.md`, both indexed in the README. New `scripts/check-rulebook.ts` with 25 tests covers the stub's import line (outside any fence), rule-file `paths:` entries (quoted only, no `[`) and globs that must match git-tracked files. `generate-agents-md.ts`, the npm script and the CI job are retired. `docs/GIT.md`'s required-checks sentence now names the three post-swap checks. `CLAUDE.md` citations were repointed across `docs/`, both worker agents and 4 TSDoc comments. The diff is 31 files, +614/−269.

- **Process so far:** the brief went through spec-grill R1: 1 BLOCKING (`.gitignore` hid `.claude/rules/`), 3 MATERIAL, 8 LOW. All were folded into the brief, with **no verification-round grill** — disclose that in the PR; DA R1 covers the implemented result. `implementer` then built it: 0 stops, ~219k subagent tokens. Locally green except `packages/core`'s DB-backed files (no `DATABASE_URL`).
- **Brief** (for reviewers): `.claude/research/workflow-series/pr4-brief.md` (gitignored, local only).

**Session data:** ~145k tokens at handoff (usage tool; 5-hour window 5%, weekly 32%). Trigger: phase boundary (build done) above 100k, near the 150k soft line. Most growth: the grill report and the brief. Structural warning signs: none.

**Lessons (Session 50):**

- **BBBB — Grill the brief, and check `.gitignore` for any new directory under a partly-ignored parent.** `.claude/*` is ignored except `agents/`, so the rule files would have passed `check:rulebook` locally (it reads the disk), never been committed, and failed only in CI. Only the spec-grill on the brief caught it. A brief that creates a directory should include `git check-ignore -v <new path>`.
- **CCCC — A PR that deletes the job behind a required check is unmergeable until the settings change.** Put that settings step in the PR body as a _pre_-merge action, and update the doc that lists required checks (`docs/GIT.md`, which was already stale at two checks).

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
