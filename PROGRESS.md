# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.md` for the mechanics).

## Next workstreams (after Session 64)

Updated 2026-09-28 end-Session-64 — **`fix/review-queue-sweep-rereport` is open as [PR #117](https://github.com/Pushedskydiver/moe/pull/117), not merged (Alex merges). R3 came back with 0 BLOCKING / 0 MATERIAL, and the LOW pass was applied.** At handoff CI showed 4 passing, 1 pending. The DB-backed tests' first-ever CI run was not yet confirmed. `docs/glossary-thinning` is unchanged at `c8cd765` (R3 still due). All 8 personas are `started` with checks passing.

Update (2026-09-28): #117's CI went green, 5/5. The DB-backed tests ran for the first time: all 57 `packages/core` test files passed, including `review-queue-repository.test.ts` (15 tests). The PR is `BEHIND` `main`, by the handoff commit only.

**Asked and decided:** Alex gave permission in chat to open the PR, after the auto-mode classifier blocked the push and `gh pr create` (HHHHH). Nothing else was marked Alex's.

**Done this session:**

- **Merged `origin/main`** into the branch (`677cbf7`; only the Session 63 handoff).
- **Pre-push suite at `677cbf7`:** build, lint, typecheck, format and knip passed. Every test passed except `packages/core`'s 20 DB-backed files, which failed on `DATABASE_URL is not set` plus the matching teardown `TypeError`s (checked by error class).
- **R3** (range `66ec1de..259e76e`, both isolated): DA 0 BLOCKING / 0 MATERIAL / 5 LOW (+4 FYI); surrogate 0 / 0 / 6 (+4 FYI). Reports: `sweep-fix/da-r3-report.md` and `sweep-fix/surrogate-r3-report.md`.
  - DA re-ran both mutations. Moving the `until` read above the writes fails the re-report test. Re-adding `max(since, until)` fails the backward-clock test.
  - Surrogate L1 said it would be MATERIAL "if graded strictly". The fold had reworded `sender-trigger-cache.ts:38-41` from "nothing is silently lost" to "adds no loss … beyond the sweep's own named gap", which is false: a failed review-queue write loses the message (`log-ambient-intake-to-review-queue.ts:124-130`). The orchestrator verified this at source and **graded it LOW**: it is comment-only, the loss is logged, and neither reviewer graded it MATERIAL. It was fixed in the LOW pass (IIIII).
- **LOW pass** (`implementer`, per `sweep-fix/r3-low-pass-brief.md`; report `r3-low-pass-report.md`): 4 commits, `e9ac32b..e4f44c7`. It covered all R3 LOWs: the TSDoc opening paragraph, exceptions (3) and (4), two path cites, `sender-trigger-cache.ts`, `sweep-state.ts`, `ARCHITECTURE.md:20`, and the until-edge DB test's insert assertions. **The orchestrator read the content diff** (`-w --word-diff`), and it matches the brief word for word. Prettier re-padded the `ARCHITECTURE.md` table, a whitespace-only change.
- **Self-review** (`docs/SELF-REVIEW.md`, code-level layer, `main...HEAD`): clean.
- **PR #117** was opened with labels `fix`, `server` and `core`. The body carries both fold briefs' disclosures and Alex's two veto items, plus DA R3's middle option: a `logger.warn` when `until <= since`. The surrogate R1–R3 reports are posted as one comment. The PR is bound to the desktop app's CI monitor.

**In flight:** PR #117's CI (1 check pending at handoff).

**Next, and open questions for Alex:**

- **[ALEX]** Merge #117, or veto one of the two trades in its body: (a) a guard, rather than recording a backward `until`; (b) a settle delay, rather than accepting gap (4). The option of a warn log sits under (a).
- Confirm the DB-backed tests pass in #117's CI. They have never run before.

**Cleanup:** both R3 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. `fix/review-queue-sweep-rereport` is kept (open PR) and `docs/glossary-thinning` is kept (unpushed). Session 59 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~150k tokens at handoff (usage tool; 5-hour window 14%, weekly 47%, Fable weekly 4%). Context at load: 78.4k, so row 1 fired at ~118.4k.

- **Trigger:** row 1. It was due at the LOW-pass commit (139k). The session carried on only to open the PR, and that was held up on the permission block. Row 2 (150k) was reached while writing the handoff.
- **What grew context most:**
  - The ~78k loaded start (`origin/main`'s `PROGRESS.md` read first again).
  - Reading the SESSION-HANDOFF doc (~6k).
  - Reading the sites to settle the LOW brief, plus writing the brief (~8k).
  - The self-review diff reads (~6k).
  - The two R3 hand-backs (~3k).
- **Subagent tokens:** DA R3 158k, surrogate R3 131k, LOW pass 74k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 64):**

- **HHHHH — The auto-mode classifier blocked `git push` + `gh pr create` for the PR the loading instructions scheduled, and gave no reason.** Alex's explicit chat permission cleared it. The handoff's own direct-to-`main` push may hit the same block. Before a push or PR step, expect it may need Alex's word in chat, and batch the outward-facing steps so one ask covers them. → memory (`harness-and-tooling-gotchas.md`).
- **IIIII — A fold that rewords a qualified claim can drop the qualifier and create a new false absolute.** "nothing is _silently_ lost" became "adds no loss", and a logged loss path made it false. When a fold rewords a hedge, check that the hedge survived. → `REVIEW-PATTERNS.md` §Over-correction.

### Session 65 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`**, not the working tree's copy (YYYY, GGGGG).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `913013c`), `git status`, and `gh pr list` (expect #117, unless Alex has merged it).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: PR #117.**
  - CI was green at handoff, DB-backed tests included (see the Update line). Re-check it with `mcp__ccd_pr__get_status` only if the branch has moved.
  - Read Alex's review comments. If he vetoed a trade, apply decision branch 3.
- **Then: finish `docs/glossary-thinning`**, per the Session 62 entry's loading instructions (step "Then: finish `docs/glossary-thinning`"). R3 on `04c6ec3..c8cd765`, then the PR. Labels: `chore`, `server`, `github`, `core`.
  - If #117 has merged first, resolve the conflicts in `review-queue-repository.ts`, `schema.ts`, `review-queue-sweep.ts` and `sender-trigger-cache.ts` in favour of #117. Also take #117's `ARCHITECTURE.md:20` and `sweep-state.ts` wording if they conflict.
  - GLOSSARY `:54`: scope "never misses a row" / "double-reports" to the sweep TSDoc's four exceptions (decision branch 2). Surrogate R3 FYI A found three more phrases there that #117 fixed everywhere else: "the codebase has no scheduled-job infrastructure" (false: the pull loop's `setInterval`), "since the persona's last sweep", and "'last swept at' timestamp". Fix them in the same pass.
- **Then the SESSION-HANDOFF PR**, as specified in the Session 61 entry: row 1 → load + 40k, the "context at load" field, prompt step 1 → `origin/main` (GGGGG is supporting evidence), and the PPPP, SSSS and YYYY harvests. IIIII rides in the next PR that touches `REVIEW-PATTERNS.md`.
- **Decision branches:**
  1. If the glossary R3 finds BLOCKING/MATERIAL, fold it and run R4. Reaching R4 means ask Alex (`docs/DEVELOPMENT.md` §Review Gate).
  2. GLOSSARY `:54` on the glossary branch: see above.
  3. **[ALEX]** If Alex vetoes a trade on #117: for a guard, re-add `max(since, until)` and reword exception (3) as a gap; for a settle delay, add it as a fold; for the warn log, add a `logger.warn` when `until <= since` and mention it in exception (4). Each is a fold on the branch, followed by a range check.
- **Carry-overs:**
  - WWWW into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream. Candidates are in `git show 3abde05:PROGRESS.md`'s Session 52 entry. Confirm the order with Alex.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 65:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 63

Updated 2026-09-28 end-Session-63 — **`fix/review-queue-sweep-rereport` is R2-reviewed and R2-folded on the local branch (`259e76e`; not pushed, no PR yet). R2 found MATERIALs, all folded, including one behaviour change: the backward-clock guard was removed. An R3 range check on `66ec1de..259e76e` is next.** `docs/glossary-thinning` is unchanged at `c8cd765` (R3 still due). All 8 personas are `started` with checks passing.

**Asked and decided:** nothing. Nothing this session was marked Alex's.

**Done this session:**

- **Merged `origin/main`** into the branch (`66ec1de`; only the Session 62 handoff).
- **Pre-push suite at `9d8e125`** (orchestrator): build, lint, typecheck, format and knip passed. Every test passed except `packages/core`'s 20 DB-backed files, which fail on `DATABASE_URL is not set` (plus teardown fallout from the same cause).
- **R2** (range `41e4a36..9d8e125`, both isolated): DA 0 BLOCKING / 2 MATERIAL / 8 LOW (+1 FYI); surrogate 0 / 1 / 9 (+6 FYI). Reports: `sweep-fix/da-r2-report.md` and `sweep-fix/surrogate-r2-report.md`. Every R1 item was applied. Both reviewers re-ran the mutation checks: moving the `until` read above the writes fails the F2 test, and reverting the guard failed its test.
  - Converged MATERIAL, verified at source: the new exceptions list said "none of them silent", but exception (3) is a silent miss (`:422` "the one true gap").
  - DA M2: the "loses nothing" claims were false. When the clock reads backward, this run's own `'mid-silence'` rows (stamped at or before `until`, which is at or before `since`) fall into neither window.
  - DA L6, and the orchestrator's decision: the R1 guard (`sweptAt = max(since, until)`) breaks the file's own rule that over-reporting beats a miss. A backward step means the earlier reading was fast, and holding `lastSweptAt` at that future value skips rows later stamped in `(until, since]`.
- **R2 fold** (`implementer`, per `sweep-fix/r2-fold-brief.md`; report `r2-fold-report.md`): 4 commits, `edc163e..259e76e`, 7 files.
  - **The guard is removed; `sweptAt: until` again.** This is R1 L3's other option.
  - The TSDoc now lists four exceptions: (1)–(3) are overlaps, (3) being the new backward-clock case; (4) is the stamp-versus-listing gap. Only (1) and (2) are logged. The wording is settled in the brief.
  - The builder reported the backward test red against the guard and green without it, and the F2 mutation still red.
  - Siblings were fixed (`schema.ts`, `review-queue-repository.ts`, `sender-trigger-cache.ts`, `sweep-state-repository.ts`), and `docs/ARCHITECTURE.md:15,20` too. All LOWs applied.
  - Suite reported green except the DB-backed core files.
  - **Orchestrator verified only:** the commit list, a clean tree, and that `later of` and `none of them silent` are gone from `apps packages`. Everything else is R3's to check.

**In flight:** nothing running.

**Next, and open questions for Alex:** nothing waiting on Alex. For his veto in the PR: (a) recording `until` even when the clock reads backward (an accepted, skew-bounded re-report) rather than a guard; (b) R1 DA L5's trade: the per-run double report swapped for gap (4), bounded by commit latency plus clock skew, rather than adding a settle delay.

**Cleanup:** both R2 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. Both `fix/review-queue-sweep-rereport` and `docs/glossary-thinning` are kept (unpushed work). Session 58 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~125k tokens at handoff (usage tool; 5-hour window 50%, weekly 44%, Fable weekly 4%). Context at load: 81.7k (usage tool), so row 1 fired at ~121.7k.

- **Trigger:** row 1, a phase boundary (R2 fold committed) at 119.3k, with the handoff itself crossing load+40k.
- **What grew context most:**
  - The ~82k loaded start (~10k less than Sessions 61–62: `origin/main`'s `PROGRESS.md` was read first, so no stale read).
  - The two R2 hand-backs (~4k).
  - The pre-push log triage (~2k).
  - The guard trace, from source reads plus the R1 L3 lookup (~3k).
  - Writing the fold brief (~3k).
- **Subagent tokens:** DA R2 153k, surrogate R2 146k, R2 fold 170k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 63):**

- **FFFFF — A fold chose between a reviewer's two options against the reviewer's framing, not the code's own priority rule.** R1 L3 offered "add a guard, or name it as an exception". The guard was chosen because it stopped an overlap. Nobody checked it against the file's stated rule that over-reporting beats a silent miss, and it inverts that rule in the very case it names. When a fold picks between options, test the pick against the code's stated invariants, not just the finding. → none (instance of the over-correction class, `docs/REVIEW-PATTERNS.md` §Over-correction).
- **GGGGG — Reading `origin/main`'s `PROGRESS.md` first cut load by ~10k.** Loaded at 81.7k, against 91–92k when the stale branch copy was read first (YYYY). → none (evidence for the pending SESSION-HANDOFF PR's prompt step 1 change).

### Session 64 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`**, not the working tree's copy (YYYY, GGGGG).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `ab66582`), `git status`, `gh pr list`, and `git log --oneline 66ec1de..fix/review-queue-sweep-rereport` (expect 4 commits, ending `259e76e`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: finish `fix/review-queue-sweep-rereport`.**
  1. Check out the branch; merge `origin/main` if it has moved.
  2. Run the R3 range check on `66ec1de..259e76e`, DA and surrogate in parallel and isolated. Both check every item in `sweep-fix/r2-fold-brief.md`: applied as settled, true at source, no new false absolute. Grep the concept terms repo-wide.
     - DA re-runs the F2 ordering mutation. It also re-adds a `max(since, until)` guard and confirms the rewritten backward-clock test fails.
     - DA checks exception (4)'s wording against the code paths, including this run's own writes.
     - Per UUUU/XXXX: git only in their own worktree; reports written there and `cp`'d to `sweep-fix/`. Their worktrees start on `main`, so tell them to detach at the branch HEAD.
     - 0 BLOCKING/MATERIAL → the disclosed LOW pass, then self-review (`docs/SELF-REVIEW.md`).
  3. Run the full pre-push suite (tests via `pnpm -r --no-bail --if-present run test`, WWWW), push, and open the PR: `🐛 fix(server): stop the review-queue sweep re-reporting its own writes`, labels `server` and `core` (plus the type label per `docs/GIT.md`).
     - Body: the "Dismissed / PR body" items from both `r1-fold-brief.md` and `r2-fold-brief.md`. That covers DA L4 (the squash hides the red intermediate commit), L9 (the first sweep after merge re-reports once), and the 3-file conflict with `docs/glossary-thinning`.
     - Two items are for Alex's veto: recording a backward `until` rather than a guard, and gap (4) rather than a settle delay.
     - Also say the DB-backed tests first run in CI. Post the surrogate reports (R1–R3) as one comment.
  4. Watch the DB-backed tests in CI. They have never run.
- **Then: finish `docs/glossary-thinning`**, per the Session 62 entry's loading instructions (step "Then: finish `docs/glossary-thinning`"). R3 on `04c6ec3..c8cd765`, then the PR. Labels: `chore`, `server`, `github`, `core`.
  - If the sweep PR has merged first, resolve the conflicts in `review-queue-repository.ts`, `schema.ts`, `review-queue-sweep.ts` and now `sender-trigger-cache.ts` in favour of the sweep PR. GLOSSARY `:54` ("never misses a row") must be scoped to exception (4) (decision branch 2).
- **Then the SESSION-HANDOFF PR**, as specified in the Session 61 entry: row 1 → load + 40k, the "context at load" field, prompt step 1 → `origin/main` (GGGGG is supporting evidence), and the PPPP, SSSS and YYYY harvests.
- **Decision branches:**
  1. If the sweep R3 finds BLOCKING/MATERIAL, fold it and run R4 — reaching R4 means ask Alex (`docs/DEVELOPMENT.md` §Review Gate). Same for the glossary R3.
  2. GLOSSARY `:54` on the glossary branch: scope "never misses a row" / "double-reports" to the sweep TSDoc's four exceptions before the glossary PR opens.
  3. **[ALEX]** If Alex vetoes either trade on the sweep PR: for a guard, re-add `max(since, until)` and reword exception (3) as a gap; for a settle delay, add it as a fold.
- **Carry-overs:**
  - WWWW into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream. Candidates are in `git show 3abde05:PROGRESS.md`'s Session 52 entry. Confirm the order with Alex.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 64:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 62

Updated 2026-09-28 end-Session-62 — **`fix/review-queue-sweep-rereport` is built, R1-reviewed and R1-folded on a local branch (`9d8e125`; not pushed, no PR yet). R1 found 3 MATERIALs, all folded, so an R2 range check on `41e4a36..9d8e125` is next.** `docs/glossary-thinning` is unchanged at `c8cd765` (R3 still due). All 8 personas are `started` with checks passing.

**Asked and decided:** nothing. Nothing this session was marked Alex's.

**Done this session:**

- **Build** (`implementer`, from `main` @ `84ddfd9`, per `.claude/research/workflow-series/sweep-fix/build-brief.md`): `7cb20b4` (core) and `f4fe25c` (server).
  - `listReviewQueueEntriesSince` takes a required `until`, making the window `(since, until]`.
  - `SweepDeps` gets an injected `clock`. `until` is read after the run's own `'mid-silence'` writes, and `sweptAt: until` is recorded.
  - The orchestrator ran the new tests against `main`'s `review-queue-sweep.ts`: 3 failed, including both new re-report tests.
- **Architectural pass** (orchestrator, `41e4a36`): the repository and sweep TSDocs pointed at each other for the known gap, and schema.ts's "neither overlap nor gap" stood unqualified.
- **R1** (range `main...41e4a36`, both isolated): DA 0 BLOCKING / 2 MATERIAL / 10 LOW; surrogate 0 / 1 / 5 (+2 FYI). Reports: `sweep-fix/da-r1-report.md`, `sweep-fix/surrogate-r1-report.md`.
  - Converged, graded MATERIAL: the "read `until` after the writes" ordering was untested (DA moved the line and all 16 tests still passed). `:380` still said "the codebase has no scheduled-job infrastructure" (false: the pull loop's `setInterval`).
  - Surrogate MATERIAL: "neither overlap nor gap" left out the two by-design re-report paths (the epoch fallback and a failed `recordSweepCompleted`). The build brief had required both.
- **R1 fold** (`implementer`, per `sweep-fix/r1-fold-brief.md`; report `r1-fold-report.md`): 7 commits, `cb44046`..`9d8e125`.
  - New code guard: `lastSweptAt` never moves backward (`sweptAt = until > since ? until : since`, DA L3).
  - The ordering test uses one shared advancing clock. The builder reported moving the clock read above the writes and seeing it fail. **Not re-verified by the orchestrator**; R2 checks it.
  - The `:380` wording matches `docs/glossary-thinning`'s exactly.
  - LOWs L1–L7 applied. Dismissed or PR-body only: DA L4, L5, L9, L10 and the surrogate FYIs (the brief's last section).
  - Suite reported green except `packages/core`'s DB-backed files (no `DATABASE_URL`). The new DB tests have only been read, not run; CI is their first run.

**In flight:** nothing running.

**Next, and open questions for Alex:** nothing waiting on Alex. For his veto in the PR: DA L5, whether the fix's trade (a per-run double report swapped for a millisecond-scale miss window at `until`) is right, or a settle delay should be added.

**Cleanup:** both R1 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. Both `fix/review-queue-sweep-rereport` and `docs/glossary-thinning` are kept (unpushed work). Session 57 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~148k tokens at handoff (usage tool; 5-hour window 41%, weekly 43%, Fable weekly 4%). Context at load: 91.6k (usage tool), so row 1 fired at ~131.6k.

- **Trigger:** row 1, a phase boundary (R1 fold committed) at ~146k, past load+40k.
- **What grew context most:**
  - The ~92k loaded start (it included reading the branch's `PROGRESS.md` before `origin/main`'s, YYYY a fourth time, ~9k).
  - Reading the build diff (~6k).
  - The DA LOW section (~4k).
  - Four hand-backs (~1k each).
- **Subagent tokens:** build 158k, DA R1 154k, surrogate R1 111k, R1 fold 149k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 62):**

- **DDDDD — The brief settled two exception classes, and the build plus the architectural pass checked only one.** Both the builder and the orchestrator's pass checked the new comments against the brief's "known gap" but never walked its full settled-semantics paragraph. The surrogate caught the omitted failure-path re-reports. Check an architectural pass against the brief's settled items one by one, not against a remembered gist. → none (instance of self-reported-status-needs-verification).
- **EEEEE — A mutation check found an untested key invariant that the test comment claimed was covered.** The fakes scripted fixed timestamps, so they couldn't see call order. DA moved one line and re-ran. For a fix whose correctness is an ordering or boundary, deliberately break that one thing once and watch a test fail. → none (observation; weigh it for `docs/TESTING.md` if it recurs).

### Session 63 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`**, not the working tree's copy (YYYY).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `84ddfd9`), `git status`, `gh pr list`, and `git log --oneline origin/main..fix/review-queue-sweep-rereport` (expect 10 commits, ending `9d8e125`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: finish `fix/review-queue-sweep-rereport`.**
  1. Check out the branch; merge `origin/main` if it has moved.
  2. Run the R2 range check on `41e4a36..9d8e125`, DA and surrogate in parallel and isolated. Both check every item in `sweep-fix/r1-fold-brief.md`: applied as settled, true at source, no new false absolute. DA re-runs the ordering mutation check (F2).
     - Per UUUU/XXXX: git only in their own worktree; reports written there and `cp`'d to `sweep-fix/`.
     - 0 BLOCKING/MATERIAL → the disclosed LOW pass, then self-review (`docs/SELF-REVIEW.md`).
  3. Run the full pre-push suite (tests via `pnpm -r --no-bail --if-present run test`, WWWW), push, and open the PR: `🐛 fix(server): stop the review-queue sweep re-reporting its own writes`, labels `server` and `core` (plus the type label per `docs/GIT.md`).
     - Body: the r1-fold-brief's "Dismissed / PR body" items. That covers DA L4 (the squash hides the red intermediate commit), L5 (the trade, for Alex's veto), L9 (the first sweep after merge re-reports once), and the 3-file conflict with `docs/glossary-thinning`. Also say the DB-backed tests first run in CI.
     - Post the surrogate reports as one comment.
  4. Watch the DB-backed tests in CI. They have never run.
- **Then: finish `docs/glossary-thinning`** (Session 62's loading steps, unchanged). Check out the branch and merge `origin/main`; run R3 on `04c6ec3..c8cd765`; the LOW pass, self-review and tokens per brief §4; then the PR. Labels: `chore`, `server`, `github`, `core`.
  - If the sweep PR has merged first, resolve the conflicts in `review-queue-repository.ts`, `schema.ts` and `review-queue-sweep.ts` in favour of the sweep PR's code and wording. The `:380` sentence is already identical.
- **Then the SESSION-HANDOFF PR**, as specified in the Session 61 entry below: row 1 → load + 40k, the "context at load" field, prompt step 1 → `origin/main`, and the PPPP, SSSS and YYYY harvests.
- **Decision branches:**
  1. If the sweep R2 finds BLOCKING/MATERIAL, fold it; reaching R4 means ask Alex. Same for the glossary R3.
  2. GLOSSARY `:48` on the glossary branch ("picks up where the last completed one left off", "never misses a row"): re-check it against the sweep fix's exceptions before the glossary PR opens. The known narrow commit-ordering gap may need scoping there.
  3. If Alex vetoes L5's trade on the sweep PR, add the settle delay as a fold.
- **Carry-overs:**
  - WWWW into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream (candidates in `git show 3abde05:PROGRESS.md`'s Session 52 entry). Confirm the order with Alex.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 63:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 61

Updated 2026-09-28 end-Session-61 — **`docs/glossary-thinning` has its R1 and R2 folds committed on the local branch (`c8cd765`; not pushed, no PR yet). R2 found one MATERIAL, which was folded, so an R3 range check on the R2 fold is due. Session 62 starts with the review-queue sweep re-report bug R2 found (Alex), then R3.** All 8 personas are `started` with checks passing.

**Asked and decided (Alex, 2026-09-28, in chat at handoff):** the review-queue sweep re-report bug (R2's DA M1, below) is **Session 62's first task**, before the glossary PR's R3. The desktop chip for it was withdrawn in favour of this.

**Done this session:**

- **Merged `origin/main`** into the branch (`81c71b6`; only the Session 60 handoff).
- **R1 fold brief finished** (`pr5-gloss-r1/fold-brief.md`, final, 37 find/replace items). The orchestrator made the 18 LOWs' accept/dismiss calls. A `general-purpose` agent checked each fix's source claims and wrote the settled wording. The orchestrator then spot-checked three of its surprising claims at source.
  - F4: the "revisit" clause was already met. Any persona's DM cascade commits tickets that `create-github-issues.ts` attributes to Sarah, so it became "a known simplification".
  - F5: GLOSSARY `:45` (the High-band draft) was stale as well as `:46`. `postAndPersistDraft` claims before posting (`handle-ambient-channel-message.ts`).
  - L6a: "never double-reports one" was false and was dropped from GLOSSARY `:48`.
  - Dismissed: DA L8 and L11; surrogate Findings 4, 6 and 10. Each is recorded in the brief, with a PR-body line.
- **R1 fold** (`doc-fixer`, `04c6ec3`, 6 files).
- **R2** (range `81c71b6..04c6ec3`, both isolated): DA 0 BLOCKING / 1 MATERIAL / 5 LOW; surrogate 0 / 0 / 5. Reports: `.claude/research/workflow-series/pr5-gloss-r2/`. Every R1 item was confirmed as applied and true.
  - DA M1, verified at source: "never double-reports one" survived in two `packages/core` comments. The sweep's own `'mid-silence'` rows get `createdAt = new Date()` after the run's `now` (`review-queue-repository.ts:69`), and `sweptAt: now` is then recorded. So the next sweep reports them again, a real pre-existing code bug.
  - The two reviewers converged on four LOWs: the Core hours scope, "never misses a row", "the ADR's other trigger" and the `:58` referent.
- **R2 fold** (`pr5-gloss-r2/fold-brief.md`, `doc-fixer`, `c8cd765`, 4 files): M1 and L1–L6. `packages/core` is now touched, so the PR needs the label `core`. DA L-5 (a new but true `:46` tag) and the commit-shape note were dismissed.
- **Sweep bug:** a follow-up chip was spawned, then withdrawn once Alex moved the bug into Session 62's loading instructions. It isn't fixed in this docs PR.

**In flight:** nothing running.

**Next, and open questions for Alex:** nothing waiting on Alex.

**Cleanup:** the two R2 review worktrees and their branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. `docs/glossary-thinning` is kept (unpushed work). Session 56 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~142k tokens at handoff (usage tool; 5-hour window 34%, weekly 42%, Fable weekly 4%). Context at load: 91.3k (usage tool), so row 1 fired at ~131k.

- **Trigger:** row 1, a phase boundary (R2 fold committed) at 140.4k, past load+40k.
- **What grew context most:**
  - The ~91k loaded start.
  - Reading the branch's stale `PROGRESS.md` before `origin/main`'s (~9k; YYYY for the third time).
  - The R1 and R2 LOW sections (~6k and ~5k).
  - Six hand-backs (~1k each).
- **Subagent tokens:** brief settle 199k, R1 fold 82k, DA R2 153k, surrogate R2 142k, R2 fold 41k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 61):**

- **BBBBB — A claim dropped as false in the doc survived in code siblings outside the PR's files.** The R1 brief dropped "never double-reports one" from GLOSSARY. Its sibling grep ran only over the files in scope, and R2 found the same claim in two `packages/core` comments. When a fold drops a claim as false, grep its concept terms across the whole repo. → none (instance of AAAAA and the existing review-gate sibling rule).
- **CCCCC — Delegating the fold brief's source checks kept the fold loop inside one session.** The orchestrator made the triage calls, and a `general-purpose` agent (199k) checked sources and wrote the wording. The orchestrator paid ~6k for the LOW reads plus ~3k for spot checks, not ~20k+. The agent's three surprising claims all held at source. → none (observation; weigh it for `docs/DEVELOPMENT.md` §Session Pattern if it holds up again).

### Session 62 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`**, not the working tree's copy (YYYY).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `8e27f4c`), `git status`, `gh pr list`, and `git log --oneline origin/main..docs/glossary-thinning` (expect 8 commits, ending `c8cd765`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: fix the review-queue sweep re-report bug** (Alex, 2026-09-28). It's a code bug, so it gets its own branch from a freshly pulled `main` (e.g. `fix/review-queue-sweep-rereport`) and its own PR, type `🐛 fix`.
  - The bug: `runReviewQueueSweep` (`apps/server/src/review-queue-sweep.ts`) takes `now`, writes `'mid-silence'` rows stamped `createdAt: new Date()` after it (`packages/core/src/intake/review-queue-repository.ts:69`), then records `sweptAt: now`. The next sweep lists `createdAt > since` (`:99`), so those rows are reported twice. Evidence: `pr5-gloss-r2/da-r2-report.md` M1. Also weigh its L-2 clock-skew race: a row stamped before `now` but committed after the listing.
  - TDD (`docs/TESTING.md`): first a failing test showing the double report across two consecutive sweeps, then the fix.
  - Keep the comments at `review-queue-repository.ts:~86-88` and `packages/core/src/schema.ts:~228-229` true. On `main` they still say "never double-reports one"; the glossary branch rewords them. Whichever PR merges second resolves the overlap.
  - Build it with `implementer`, then run the review gate (`docs/DEVELOPMENT.md` §Review Gate) and open the PR (Alex merges). Labels: `server`, plus `core` if `packages/core` changes.
- **Then: finish `docs/glossary-thinning`.**
  1. Check out the branch; merge `origin/main` if it has moved.
  2. Run the R3 range check on `04c6ec3..c8cd765`, DA and surrogate in parallel and isolated. Both check every item in `pr5-gloss-r2/fold-brief.md`: applied as settled, true at source, no new false absolute.
     - Per UUUU/XXXX: git only in their own worktree; reports written there and `cp`'d to `pr5-gloss-r3/`.
     - 0 BLOCKING/MATERIAL → the disclosed LOW pass, then self-review (`docs/SELF-REVIEW.md`).
     - Cosmetic item for the LOW pass: `apps/server/src/review-queue-sweep.ts:375`'s orphaned "Lists every" line wrap.
  3. Measure tokens per brief §4 at three points, in one run: `main`, `dbae5a3`, HEAD, for GLOSSARY and ARCHITECTURE.
  4. Run the full pre-push suite (tests via `pnpm -r --no-bail --if-present run test`, WWWW), push, and open the PR per brief §5.
     - Labels: `chore`, `server`, `github`, `core`.
     - The body carries both fold briefs' "Carry into the PR body" lists and the token figures.
     - Post the surrogate reports (R1 on) as one comment.
- **Then the SESSION-HANDOFF PR** (decided in Session 60; its own branch):
  - §1 row 1 → load + 40k.
  - A §9 "context at load" field.
  - §5 prompt step 1 → fetch, then read `origin/main`'s `PROGRESS.md`. YYYY has now recurred 3 of 3 times.
  - The due harvests: PPPP (§6), SSSS (§9) and YYYY (§5/§6).
  - Check whether `docs/GIT.md`'s blast-radius list names SESSION-HANDOFF; if it does, the surrogate is mandatory.
- **Decision branches:**
  1. If R3 finds BLOCKING/MATERIAL, fold it; reaching R4 means ask Alex.
  2. If the sweep fix changes the "picks up where the last completed one left off" behaviour that GLOSSARY `:48` now describes, re-check that line before the glossary PR opens.
- **Carry-overs:**
  - WWWW into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream (candidates in `git show 3abde05:PROGRESS.md`'s Session 52 entry). Confirm the order with Alex.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 62:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 60

Updated 2026-09-28 end-Session-60 — **[#116](https://github.com/Pushedskydiver/moe/pull/116) merged (`2796725`). `docs/glossary-thinning` is built and R1-reviewed on a local branch (`9cc684d`; not pushed, no PR yet). Its R1 fold is half-briefed: the MATERIALs are settled, the LOWs are untriaged.** All 8 personas are `started` with checks passing.

**Asked and decided (Alex, 2026-09-27, `AskUserQuestion`; this is §9's first ten-session review):**

1. `docs/SESSION-HANDOFF.md` §1 row 1 (phase boundary) fires once the session is **40k above its own loaded start**, not at 100k absolute. The 150k and 250k lines stay absolute. Why: the load now costs ~87–95k (tool schemas ~49k), so 100k fired after ~10k of work.
2. Alex left the other review items to Claude, "as long as you have strong, real evidence":
   - **Yes:** a "context at load" Session data field (§9). Row 1 now depends on it.
   - **Yes:** the paste-in prompt's step 1 reads `origin/main`'s `PROGRESS.md` after a fetch. YYYY recurred this session, so 2 of 2 branch resumes read a stale copy.
   - **No backfill** of Sessions 46–52's missing fields. They stay "not recorded".

The review's data (Sessions 46–59) showed:

- Triggers: 6 at a phase boundary under 150k, 3 at a phase boundary past 150k, 2 at phase and soft line together, 1 at the soft line mid-work, 2 at the 250k line (Sessions 46–47 only).
- Never fired: the 5-hour row (40% max), warning signs, topic switch. No compactions. No clarifying questions since the field began (Session 53).

**Until the SESSION-HANDOFF PR merges, apply decision 1 as already in force.**

**Done this session:**

- **#116:** merged `main` in (it was `BEHIND`) and pushed; Alex merged it. The local branch was deleted.
- **Build** (`implementer`, 0 stops): `dbae5a3` (tables to lists), `b8861bb` (GLOSSARY thinned), `210b58e` (ARCHITECTURE caught up), `e053e2f` (two code comments), then the merge `9cc684d`.
  - The orchestrator re-ran §5.1's two diff checks and §5.4's three checks; all clean.
  - It also checked the identifier-loss list's code-side drops: `'mid-no-response'`, `logToReviewQueue` and `isSituationallyAppropriate` are retired or renamed in code.
  - Report: `.claude/research/workflow-series/pr5-gloss-build/build-report.md`.
- **Architectural pass:** section headings intact, the intro wording is the settled text, commit 3's inserts are verbatim. No fix commit.
- **R1** (range `origin/main...9cc684d`, both reviewers isolated): DA 0 BLOCKING / 2 MATERIAL / 11 LOW; surrogate 0 / 3 / 7. Reports: `.claude/research/workflow-series/pr5-gloss-r1/`. All 5 MATERIALs were verified at source by the orchestrator.
  - DA M1: "Alex confirmed" tags were deleted, not compressed (e.g. GitHub issue discovery 6 → 0).
  - DA M2: a sibling "no persona has an authored voice yet" survives at `compose-external-post-body.ts:21-22`.
  - Surrogate: "the repo has no scheduler" is false (the pull loop); the Sarah comment overclaims her role; the confirming-question TSDoc gives the pre-5.2b post-then-persist order.
- **Fold brief:** `pr5-gloss-r1/fold-brief.md`, **partial**. F1–F5 are settled, but F4's last clause and F5's GLOSSARY sibling each carry a "check before settling" step. The 18 LOWs are untriaged.

**In flight:** nothing running.

**Next, and open questions for Alex:** nothing waiting on Alex.

**Cleanup:** both R1 review worktrees and their branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. `docs/development-thinning` was deleted (merged). `docs/glossary-thinning` is kept (unpushed work). Session 55 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~158k tokens at handoff (usage tool; 5-hour window 26%, weekly 41%, Fable weekly 4%). Context at load: 94.9k (usage tool). That includes reading the branch's stale `PROGRESS.md` first again (YYYY).

- **Trigger:** 150k soft line, together with decision 1's load+40k (~135k). R1 was the unit in progress; it was digested and the fold brief written, then this handoff.
- **What grew context most:**
  - The ~95k loaded start.
  - Brief §4–§8 (~6k).
  - Five hand-backs (~1.5k each).
  - Source checks on the MATERIALs (~4k).
- **Subagent tokens:** build 257k, DA R1 232k, surrogate R1 219k, §9 data compile 80k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none. But YYYY cost a stale read again.

**Lessons (Session 60):**

- **ZZZZ — The identifier-loss check only sees backticks, so decision tags vanished unseen.** §5.4's `comm` check compares backtick tokens. The builder then reported tags "compressed throughout", and five entries had none. A mechanical check covers only what it greps. For each must-keep class, add a plain-text count (main vs HEAD, e.g. `grep -oi 'Alex confirm'`). → none (instance of self-reported-status-needs-verification).
- **AAAAA — The sibling-claim grep searched the replaced sentence, not the claim.** The builder grepped GLOSSARY's exact wording, while the code sibling said "no persona has an authored voice yet". `DEVELOPMENT.md`'s rule already says to grep the distinctive wording of each corrected claim. Brief it as concept terms ("authored voice", "persona voice"), not the old sentence. → none (instance of the existing review-gate rule).

### Session 61 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`**, not the working tree's copy (YYYY).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `2796725`), `git status`, `gh pr list`, and `git log --oneline origin/main..docs/glossary-thinning` (expect 5 commits, ending `9cc684d`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 now fires at that figure + 40k.
- **Primary: finish `docs/glossary-thinning`.**
  1. Check out the branch; merge `origin/main` if it has moved.
  2. Finish `pr5-gloss-r1/fold-brief.md`:
     - Resolve F4's and F5's "check before settling" steps at source.
     - Triage the 18 LOWs from both reports into it, with settled wording, each source claim checked first.
     - Dispatch `doc-fixer` once; commit the fold.
  3. Run the R2 range check on the fold range, DA and surrogate in parallel and isolated. Name the folded findings: DA gets F1–F2 plus its LOWs; the surrogate gets F3–F5 plus its LOWs.
     - Per UUUU/XXXX: git only in their own worktree; reports written there and `cp`'d to `pr5-gloss-r2/`.
     - Loop until 0 BLOCKING/MATERIAL (ask Alex at R4), then the disclosed LOW pass, then self-review.
  4. Measure tokens per brief §4 at three points, in one run: `main`, `dbae5a3`, HEAD, for GLOSSARY and ARCHITECTURE.
  5. Run the full pre-push suite (`pnpm -r --no-bail --if-present run test` for tests, WWWW), push, and open the PR per brief §5: labels `chore`, `server`, plus `github` for F2. The body carries the fold brief's "Carry into the PR body" list and the token figures. Post the surrogate reports (R1 on) as one comment.
- **Then the SESSION-HANDOFF PR** (decided above; its own branch):
  - §1 row 1 → load + 40k.
  - A §9 "context at load" field.
  - §5 prompt step 1 → fetch, then read `origin/main`'s `PROGRESS.md`.
  - The due harvests: PPPP (§6), SSSS (§9), YYYY (§5/§6).
  - Check whether `docs/GIT.md`'s blast-radius list names SESSION-HANDOFF; if it does, the surrogate is mandatory.
- **Decision branches:**
  1. If the glossary R2 loop reaches R4, ask Alex.
  2. F4: whether the "revisit" clause is already met decides its wording (the fold brief gives both).
- **Carry-overs:**
  - WWWW into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream (candidates in `git show 3abde05:PROGRESS.md`'s Session 52 entry). Confirm the order with Alex.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 61:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
