# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 52)

Updated 2026-09-27 end-Session-52 — **PR 4 (single rulebook) is open as [PR #114](https://github.com/Pushedskydiver/moe/pull/114), not merged (Alex merges). Its Round-2 loop converged at R3, and the required-check swap is done.** The branch `chore/single-rulebook` is at `d4a204d` (`main` merged in, because `strict: true` needs it up to date). CI was pending at handoff. All 8 personas are `started` with checks passing.

**Asked and decided (Alex, 2026-09-27, this session):** Alex told Claude to update `main`'s required checks. Claude applied the change: "AGENTS.md freshness" out, "Agent frontmatter" in, `strict: true` kept. A read-back confirmed `["Quality suite","Validate PR title format","Agent frontmatter"]`. "Agent frontmatter" already runs on `main`, so no other PR is blocked by it.

**Done this session:**

- **R2** (`ffdc9e6..c173da7`):
  - DA: 0 MATERIAL, 7 LOW.
  - Surrogate: 1 MATERIAL, 9 LOW. The MATERIAL was `DEVELOPMENT.md:31`, where the C7 reword brought back the A1 stub-reasoning error. DA flagged the same line independently, as a LOW.
  - Folded in `7943654` (`implementer`) and `24ac62b` (`doc-fixer`), which ran in parallel and staged by explicit path.
- **R3** (`c173da7..24ac62b`): DA 0 MATERIAL / 3 LOW; surrogate 0 MATERIAL / 6 LOW. The loop stopped.
- **LOW pass:** `a29467f` (`implementer`, 6 items). The orchestrator read the diff, and the PR discloses that no fresh context checked it.
- **Self-review:** walked for the code layer; nothing new.
- **Local suite:** green except `packages/core`'s 20 DB-backed files (no `DATABASE_URL`).
- **On the PR:** the body carries every item the Session 52 loading instructions required. Two surrogate comments are posted (R1 A–C; R2+R3), and the titles were checked. DA reports stayed in chat.
- **PR body promise:** PR 3 closes C15, `OPERATIONS.md:229`'s non-existent "§Session handoff precedent".
- **Deferred on #114:** `PERSONAS.md:5`/`:28`'s stale forward reference (next to the protected roster), and DA's HTML-comment / multi-line-code-span FYI.
- **PR 3 brief drafted** by a background `Plan` agent: `.claude/research/workflow-series/pr3-brief-draft.md` (gitignored, local, ~17 KB). It has not been grilled or reviewed yet.
- **Local reports:** all R2/R3 reports and fold briefs are in `.claude/research/workflow-series/pr4-r2/` and `pr4-r3/`.

**Cleanup:** isolated review worktrees were auto-removed (`git worktree list` shows only the primary checkout). `chore/single-rulebook` is kept because its PR is open. Session 47 was archived into `docs/history/SESSIONS.md`.

**Session data:** ~190k tokens at handoff (usage tool; 5-hour window 22%, weekly 35%).

- **Trigger:** the 150k soft line was crossed at ~160k during the R3 fold; the PR was opened first (the phase boundary), then this handoff.
- **What grew context most:** 7 review and fold reports (~4–6k each), the PR 3 brief draft (~5k), and the self-review file reads.
- **Subagent tokens:** DA R2 106k, surrogate R2 238k, surrogate R3 155k, DA R3 94k, brief draft 155k, folds 71k + 84k + 51k.
- **Structural warning signs:** none.

**Lessons (Session 52):**

- **FFFF — A fold brief's settled wording is prose too, and it needs the same claim check.** Two of R3's LOWs were verbatim wording from the orchestrator's own R2 brief: `CONVENTIONS.md:5` ("the configs implement this document", which overclaims) and `SINGLE-RULEBOOK.md:18` ("Alex made the swap", which names the wrong actor). The fixer applies settled wording exactly as given, so nobody verifies it before the next round. Before writing a replacement sentence into a brief, check it against the source, just as you would a sentence in a doc.
- **GGGG — Reviewer convergence, instances 10–11.** At R2, DA and the surrogate independently flagged `DEVELOPMENT.md:31` (DA as a LOW, the surrogate as a MATERIAL). At R3, both flagged the permissive indented-fence test and the lone-CR regression. Grade by the higher of the two severities, and still verify.
- **HHHH — `pr4-r1/extract-handback.py` only returns strings containing BLOCKING/MATERIAL/LOW.** A non-review report, such as a brief, extracts as empty. Use an unfiltered variant for those (the same walk, keep the longest string).

### Session 53 loading instructions

- **Check live state first:**
  - `git log --oneline -3 origin/main` (expect this handoff on top of `4b4536f`), `git status` and `gh pr list`.
  - #114's CI and merge state: `mcp__ccd_pr__get_status`, or `gh pr view 114`.
  - `fly status` for all 8 persona Apps (`moe-sarah`, `-riley`, `-marcus`, `-priya`, `-dom`, `-theo`, `-nia`, `-maya`).
- **#114:**
  - If CI is red, fix it on the branch. A fix to a reviewed line needs its own range check.
  - If Alex merged it, delete the local branch `chore/single-rulebook`, which needs no permission.
  - If it's still open and `BEHIND` again, merge `origin/main` in.
- **Then PR 3, the handoff protocol.** Start from `.claude/research/workflow-series/pr3-brief-draft.md`.
  1. Branch `docs/session-handoff` from `main` **after #114 merges**. PR 3 edits the single-rulebook `AGENTS.md`, and `main` still has the generated one until then. The draft's file:line references were taken at `c173da7`, so re-grep all of them.
  2. Settle the draft's open items as the orchestrator:
     - keep the Fable row as a trial row;
     - add "no review IDs in code comments" to `implementer.md`;
     - DDDD and HHHH go to memory, not repo docs;
     - post-handoff decisions go in a dated "Update:" line;
     - branch timing is as in step 1.
  3. **Ask Alex the one item marked as his:** should the weekly plan limit get its own handoff trigger? The recommendation is no new trigger row: record the weekly percentage in every entry, and name it in the handoff notice at ≥85%.
  4. Run `spec-grill` R1 on the brief and fold its findings. Then run a verification round, which PR 4 skipped (lesson BBBB). The brief must include `git check-ignore -v` for the new path.
  5. Have `implementer` build it, then run the full review gate. The surrogate is mandatory: the diff touches blast-radius docs and is over 50 LOC.
  6. **PR 3 must close C15** (`OPERATIONS.md:229`), as #114's body promises. The draft's section G already plans it.
- **After PR 3, as before:** PR 5 (docs thinning, plus the VISION:327 edit, which is Alex's call), then the Hook PR, then the chief-clancy doc-port workstream (Alex reopened it at the end of Session 51):
  - **Candidates**, from `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md`, whose re-entry conditions look met: `docs/roles/` (one file per role; the personas exist), and `LIFECYCLE.md` / `VISUAL-ARCHITECTURE.md` (Stage 4+ is complete).
  - `guides/` needs a judgment call on whether moe counts as an "installable/configurable deployed surface". `TECHNICAL-REFERENCE.md` / `COMPARISON.md` stay out.
  - Do it after PR 5, so docs aren't ported into files about to be thinned. Confirm the order and which docs to port with Alex when it starts.
  - **Mechanics:** a dated "Status update" in `CHIEF-CLANCY-DOC-PORTS.md` (lifecycle in `docs/decisions/README.md`), mirrored in `BUILD_PLAN.md` §Deliberately not scheduled.
- **Recommended model and effort for Session 53:** Opus, `high`.
- **Decision branches:** FFFF–HHHH above, DDDD–EEEE in the Session 51 entry, and earlier ones via `git log -p PROGRESS.md`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 51

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
  - A6: `CHIEF-CLANCY-DOC-PORTS.md`'s `roles/` and Stage-4 re-entry conditions look met. **Alex reopened the deferral (2026-09-27, end of Session 51).** It is its own workstream after PR 4 (see the latest loading instructions), not part of PR 4.
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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
