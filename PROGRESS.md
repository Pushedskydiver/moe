# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.md` for the mechanics).

## Next workstreams (after Session 55)

Updated 2026-09-27 end-Session-55 — **PR 3 (the session handoff protocol) is open as [PR #115](https://github.com/Pushedskydiver/moe/pull/115), not merged (Alex merges). Its Round-2 loop converged at R3.** The branch `docs/session-handoff` is at `dc33bdc` (`main` merged in). CI was pending at handoff, and this handoff makes #115 `BEHIND` again. All 8 personas are `started` with checks passing.

**Update (2026-09-27):** Alex merged #115 at 19:59 UTC (`a3efc7b`), with the `GIT.md` blast-radius line kept. The local `docs/session-handoff` was deleted, and the remote branch was already gone. Line 3 now points to `docs/SESSION-HANDOFF.md`.

**Asked and decided:** nothing. Nothing on PR 3 was Alex's to decide except the merge and the `GIT.md` blast-radius veto; the PR body names both.

**Done this session:**

- **R2** (`e5c4d35..d78ce6d`): DA 0 BLOCKING / 2 MATERIAL / 4 LOW; surrogate 0 / 2 / 3. Both reviewers flagged the same two MATERIALs. One was a bare "PR 3" series label in `SESSION-HANDOFF.md:161` and the decision doc's `:50`, which came from the surrogate's own R1 F7 fix wording. The other was the M2 fold swapping "zero bookkeeping" for another false absolute, "the only standing record". Both were checked at source, and the orchestrator settled the fold wording against `5f63516:PROGRESS.md` and `SESSIONS.md` row 47. `doc-fixer` folded them in `56bced0`.
- **R3** (`d78ce6d..56bced0`): DA 0 / 0 / 2; surrogate 0 / 0 / 4, and they converged on two. The loop stopped. The **LOW pass** (`9962b5c`, `doc-fixer`) was read by the orchestrator, and the PR discloses that.
- **Self-review:** the mechanical sweep at HEAD was clean.
- **Local suite:** green except `packages/core`'s 20 DB-backed files (no `DATABASE_URL`). The `typecheck:scripts`/`test:scripts`/`check:agents`/`check:rulebook` set passed (57 tests).
- **Token re-measure** (one run, Session 54's counter): `DEVELOPMENT.md` 19,370 → 14,937, `SESSION-HANDOFF.md` 7,608 (7,065 before the folds), and `AGENTS.md` 4,541 → 4,598.
- **On the PR:** the body carries every item the Session 55 loading instructions listed. The R1–R3 surrogate reports are posted as one comment. The DA reports stay local in `.claude/research/workflow-series/pr3-r{1,2,3}/`.

**Cleanup:** `git worktree list` shows only the primary checkout. `docs/session-handoff` is kept because #115 is open. Session 50 was archived into `docs/history/SESSIONS.md`.

**Session data:** ~145k tokens at handoff (usage tool; 5-hour window 40%, weekly 37%, Fable weekly 4%).

- **Trigger:** phase boundary above 100k (PR opened), under the 150k soft line.
- **What grew context most:** the self-review checklist read (~4k), four R2/R3 hand-backs (~1k each, since the full reports went to files) and the LOW-severity sections of the R2 reports (~3k).
- **Subagent tokens:** surrogate R2 104k, DA R2 102k, fold R2 45k, DA R3 61k, surrogate R3 77k, LOW pass 37k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 55):**

- **NNNN — Replacing a false absolute with a new one.** R1's M2 fold swapped "zero bookkeeping" for "the only standing record", which was also false (R2 M2). The orchestrator's own R2 wording then added "surface them as they happen", an overclaim both reviewers caught at R3. This is the over-correction pattern (`REVIEW-PATTERNS.md`, "only" in replacement text) plus FFFF, recurring on settled fold wording. When settling wording that replaces an absolute, list what the new sentence claims about every sibling item (here, all three revisit triggers), not just the one the finding named. → none (instances of the over-correction pattern and FFFF; already harvested).
- **OOOO — A reviewer's suggested fix reintroduced a defect the same round fixed.** The surrogate's R1 F7 fix wrote "PR 3" into the same sentence M1 had just cleaned of series labels. This is JJJJ again, this time on a label rather than a source attribution. Grep a reviewer's fix wording for the defect classes the same round flagged before applying it. → none (instance of JJJJ).

### Session 56 loading instructions

- **Check live state first:**
  - `git log --oneline -3 origin/main` (expect this entry's Update commit on top of `a3efc7b`, #115's squash), `git status`, `gh pr list`.
  - `fly status -a moe-<persona>` for all 8 persona Apps.
- **#115 is merged.** Follow `docs/SESSION-HANDOFF.md` from now on, including §8's lesson destination tags and §10's archival thresholds.
- **Then PR 5:** docs thinning, plus VISION:327, which is Alex's call. Brief it, then grill it (R1 plus a verification round). Following LLLL, cite GitHub numbers only and name not-yet-opened PRs by doc or branch. After PR 5 comes the Hook PR, then the chief-clancy doc-port workstream. Confirm the order and which docs to port with Alex when it starts; the candidates are in the Session 52 entry's loading instructions.
- **Recommended model and effort for Session 56:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 54

Updated 2026-09-27 end-Session-54 — **[PR #114](https://github.com/Pushedskydiver/moe/pull/114) merged (`141cfae`). PR 3 (the session handoff protocol) is built, and its R1 review is folded, on the local branch `docs/session-handoff` (`d78ce6d`; not pushed, no PR yet).** The Round-2 range check on the fold is next. All 8 personas are `started` with checks passing.

**Asked and decided:** nothing new. Alex merged #114 mid-session.

**Done this session:**

- **#114:** merged by Alex at 18:24 UTC. `chore/single-rulebook` deleted locally.
- **PR 3 build** (`implementer`, 0 stops, ~214k subagent tokens): `e460153` (new `docs/SESSION-HANDOFF.md` plus citation repoints), `9ec57b6` (`implementer.md:13`'s brief-only-label rule), `13f4e32` (lesson harvest into RATIONALIZATIONS/REVIEW-PATTERNS). None of the brief's file:lines had moved after the squash merge. The suite was green except `packages/core`'s 20 DB-backed files (no `DATABASE_URL`).
- **Architectural pass** (orchestrator, `e5c4d35`), 4 fixes to SESSION-HANDOFF.md: "Moe decides" → "Claude decides"; restored the dropped PROGRESS-in-open-PR exception; reconciled "never edit the earlier entry" with §6's `Update` line; quoted the decision doc's Rationale 4 verbatim.
- **R1** (range `main...e5c4d35`): DA 0 BLOCKING / 5 MATERIAL / 13 LOW; surrogate 0 / 3 / 15. They converged on two: series labels "PR 3/PR 4" cited as if they were GitHub PR numbers (#4 is really "add CI pipeline"), and a stale source for Session 48's token figure. Every MATERIAL was source-checked by the orchestrator. The others were §3's edit rule vs §6 (surrogate F2, which the architectural fix itself introduced), a "zero bookkeeping" contradiction (M2), undefined "Next"/open-question slots (M3), and the lost DEVELOPMENT.md:224 exception sentence (M5).
- **R1 fold** (`doc-fixer`, `d78ce6d`): all MATERIAL applied as settled wording. LOWs applied except DA L8/L12/L13 and surrogate F5/F15/F18c (FYI, pre-existing or orchestrator-owned). One deviation from the brief to disclose in the PR: DA L7 swapped `AGENTS.md`'s Key-docs read order to "PROGRESS.md, then SESSION-HANDOFF.md", to match the paste-in prompt.
- **Token measurement** (for the PR body): `docs/DEVELOPMENT.md` went from 19,370 to 14,937 tokens at `13f4e32`, and the new `docs/SESSION-HANDOFF.md` is 7,065. `AGENTS.md` went from 4,541 to 4,598. The counter is `messages.countTokens`, `claude-sonnet-5`, script at `.claude/research/workflow-series/count-tokens.mjs.txt` (gitignored; `.txt` because ESLint lints a gitignored `.mjs`): copy it to `packages/agents/count-tokens.mjs`, run `MODEL=claude-sonnet-5 node count-tokens.mjs <files>` with `.env.local`'s key exported, then delete the copy. The same counter gives 17,527 on Session 46's `DEVELOPMENT.md`, where Session 46 recorded 16,970, so only compare figures from one run.
- **Reports:** `.claude/research/workflow-series/pr3-r1/` (`da-report.md`, `surrogate-report.md`).

**In flight:** nothing running. `docs/session-handoff` is local only. Re-measure `DEVELOPMENT.md` at the final head before writing the PR body.

**Cleanup:** deleted `chore/single-rulebook`. `git worktree list` shows only the primary checkout. Session 49 archived into `docs/history/SESSIONS.md`.

**Session data:** ~140k tokens at handoff (usage tool; 5-hour window 36%, weekly 37%, Fable weekly 4%).

- **Trigger:** phase boundary above 100k (fold committed), under the 150k soft line. This is the first handoff under PR 3's own §1 table.
- **What grew context most:** 3 hand-back reports (~2–3k each, kept short by writing full reports to files) and reading SESSION-HANDOFF.md whole for the architectural pass (~8k).
- **Subagent tokens:** build 214k, surrogate R1 172k, DA R1 158k, fold 137k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 54):**

- **KKKK — The orchestrator's own architectural-pass fix introduced a MATERIAL.** It made "never edit the earlier entry" defer to §6's `Update` line, but it named only half of §6's rule (the loading-instructions amendment was missing). The surrogate caught it as F2. This is FFFF/JJJJ again, now on direct edits, not just brief wording: check a reconciling sentence against both rules it reconciles. → none (an instance of FFFF, harvested in PR 3).
- **LLLL — A series label leaked into permanent docs as a PR number.** "Caught in PR 4" came verbatim from the brief, and both reviewers flagged it independently. PR 5's brief should cite GitHub numbers only, and name a not-yet-opened PR by its doc or branch. → none (`implementer.md:13`'s new brief-only-label rule covers it).
- **MMMM — Hand-back reports written to files kept R1's context cost to ~2–3k per report**, against ~4–6k in Session 52. Ask reviewers for a short reply plus a full report file. → memory.

### Session 55 loading instructions

- **Check live state first:**
  - `git log --oneline -3 origin/main` (expect this handoff on top of `141cfae`), `git status`, `gh pr list`, and `git log --oneline main..docs/session-handoff` (expect 5 commits, ending `d78ce6d`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
- **Primary: finish PR 3.**
  1. Check out `docs/session-handoff`. If `main` has moved beyond this handoff, merge it in.
  2. Round-2 range check on `e5c4d35..d78ce6d`, with DA and surrogate in parallel. Each writes a report file under `.claude/research/workflow-series/pr3-r2/` and replies briefly. Loop until 0 BLOCKING/MATERIAL (ask Alex at R4), then do the one disclosed LOW pass and self-review (`docs/SELF-REVIEW.md`).
  3. Re-measure `DEVELOPMENT.md` and `SESSION-HANDOFF.md` with the Session 54 counter, and re-measure the 19,370 baseline (`git show main:docs/DEVELOPMENT.md` at `141cfae`) in the same run.
  4. Run the full pre-push suite, push, and open the PR: title `📝 docs: add the session handoff protocol, harvest lessons TTT–FFFF`, label `chore`. The body closes #114's C15 promise (`OPERATIONS.md:229`); flags the decision-doc Status update as amending an earlier decision on Alex's instruction; notes that REVIEW-PATTERNS' 2+-catch bar is why single-catch lessons went to RATIONALIZATIONS; discloses the architectural-pass commit, the L7 read-order deviation and the LOW-pass author-read; and says `GIT.md`'s blast-radius addition is Alex's to veto. Post the surrogate findings (R1 and later) as a PR comment.
  5. In the first handoff after PR 3 merges, repoint `PROGRESS.md:3` to `docs/SESSION-HANDOFF.md`, and start following it.
- **Nothing on PR 3 is Alex's to decide** beyond the merge and the GIT.md veto.
- **After PR 3:** PR 5 (docs thinning, plus VISION:327, which is Alex's call), then the Hook PR, then the chief-clancy doc-port workstream. Confirm the order and the docs to port with Alex when it starts; the candidates are in the Session 52 entry's loading instructions.
- **Recommended model and effort for Session 55:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 53

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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
