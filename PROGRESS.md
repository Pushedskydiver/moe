# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 53)

Updated 2026-09-27 end-Session-53 — **PR 3's brief (the session handoff protocol) is settled and grilled: R1 and an R2 verification round, both folded, then a manual pass. Building waits on [PR #114](https://github.com/Pushedskydiver/moe/pull/114), which is green and `CLEAN` but not merged (Alex merges).** `main` is unchanged apart from this handoff. All 8 personas are `started` with checks passing.

**Asked and decided (Alex, 2026-09-27, `AskUserQuestion`):** the weekly plan limit gets **no** handoff trigger row. Every entry's Session data records the weekly %, and the handoff notice names it when it is ≥85%.

**Done this session:**

- **#114:** its head was already `1463ac3` (this repo's Session 52 handoff merged in). The Quality suite finished green, so all 5 checks pass and the PR is `CLEAN`. Nothing needed fixing.
- **Brief settled** at `.claude/research/workflow-series/pr3-brief.md` (gitignored, 225 lines). The orchestrator settled the draft's open items as the Session 53 loading instructions said. It also verified the CLI context one-liner against `get_usage`: 85,174 vs 87,703, one turn of lag.
- **`spec-grill` R1:** 0 BLOCKING, 10 MATERIAL, 16 LOW. The orchestrator checked the sources behind M3–M6, M8 and M9. The fold (`doc-fixer`) applied all 26, with orchestrator overrides on M9, L1, L7, L8, L11, L12, L13 and L15.
- **`spec-grill` R2 (verification):** 25/26 confirmed folded, M1 incomplete. Plus 2 new MATERIAL (N1: stale PROGRESS line cites; N2: the summary list "overrode" the body) and 7 LOW, all folded by `doc-fixer`.
- **Manual pass:** caught 2 more. A leftover `DEVELOPMENT.md:87` cite (N9's wording missed it), and R2's own fix wording naming "Session 49" loading instructions where the source is Session 50's (lesson JJJJ). Both fixed.
- **Reports and fold briefs:** `.claude/research/workflow-series/pr3-grill/` (`r1-report.md`, `r1-fold-brief.md`, `r2-report.md`, `brief-after-r1-fold.md`).
- **Memory:** DDDD and HHHH are filed under harness/tooling, and GGGG under the reviewer-convergence note (now 11 instances; triage at the higher severity). The brief routes these three to memory.

**Cleanup:** removed the detached review worktree (`git worktree list` shows only the primary checkout). `chore/single-rulebook` is kept because #114 is open. Session 48 was archived into `docs/history/SESSIONS.md`.

**Session data:** ~150k tokens at handoff (usage tool; 5-hour window 28%, weekly 36%, Fable weekly 4%).

- **Trigger:** a phase boundary above 100k (brief final, build blocked on #114), just under the 150k soft line.
- **What grew context most:** 4 grill/fold hand-back reports (~3–5k each), the brief draft read (~5k) and the usage calls.
- **Subagent tokens:** grill R1 188k, fold R1 135k, grill R2 121k, fold R2 69k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none. The one question was pre-marked as Alex's.

**Lessons (Session 53):**

- **IIII — A fold brief's constraints can contradict its own findings.** The R1 fold brief said "keep every file:line as is" while M1 required a full fold. The constraint won, so stale PROGRESS line cites survived. The verification round caught it (N1), which is the case for running R_n on briefs. Before dispatch, check the constraints are compatible with every finding.
- **JJJJ — Reviewer fix wording is settled wording too (FFFF recurred twice, while named).** R2's paste-ready fix labelled Session 50's loading instructions "Session 49", and R1's L11 fold swapped one false Fable claim for another (N4). "Apply the Fix wording as given" hands the fixer unchecked prose. Spot-check any source attribution in a reviewer's fix before accepting it verbatim.

### Session 54 loading instructions

- **Check live state first:**
  - `git log --oneline -3 origin/main` (expect this handoff on top of `e4c7bb6`, or #114's squash above it), `git status` and `gh pr list`.
  - #114: `mcp__ccd_pr__get_status`, or `gh pr view 114`.
  - `fly status -a moe-<persona>` for all 8 persona Apps.
- **#114:**
  - If Alex merged it, delete the local `chore/single-rulebook`; this needs no permission.
  - If it's still open and `BEHIND`, merge `origin/main` in.
  - If CI is red, fix it on the branch, and give the fix its own range check.
- **PR 3, only once #114 has merged.** The brief is final: `.claude/research/workflow-series/pr3-brief.md`. Don't re-grill it; two rounds and a manual pass are done.
  1. Branch `docs/session-handoff` from a freshly pulled `main`.
  2. Dispatch `implementer` in build mode with the brief. The builder re-greps every code-doc file:line first; they were verified at `1463ac3`, and the squash merge shouldn't move them, but check.
  3. The brief's closing "Orchestrator-only steps" are yours:
     - Measure DEVELOPMENT.md's tokens before and after, with Session 46's counter (`git show 5f63516:PROGRESS.md`).
     - Run the Round-2 loop until there are 0 BLOCKING/MATERIAL, then self-review.
     - The surrogate is mandatory (blast-radius docs, >50 LOC); split it by logical grouping if the diff tops 20 files. Post its findings as a PR comment.
     - Repoint `PROGRESS.md:3` in the first handoff after PR 3 merges.
  4. The PR body closes C15 (`OPERATIONS.md:229`), as #114 promised. It also flags the decision-doc Status update as amending an earlier decision on Alex's instruction.
  - **Nothing on PR 3 is marked as Alex's to decide** (the weekly limit is settled above). GIT.md's blast-radius addition is his to veto in review.
- **After PR 3, as before:** PR 5 (docs thinning, plus VISION:327, which is Alex's call), then the Hook PR, then the chief-clancy doc-port workstream. Confirm the order and which docs to port with Alex when it starts; the candidates and mechanics are in the Session 52 entry's loading instructions.
- **Recommended model and effort for Session 54:** Opus, `high`.
- **Decision branches:** IIII–JJJJ above; FFFF–HHHH in the Session 52 entry.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 52

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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
