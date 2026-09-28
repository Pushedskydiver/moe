# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.md` for the mechanics).

## Next workstreams (after Session 66)

Updated 2026-09-28 end-Session-66 — **`docs/session-handoff-review` is built, R1-reviewed and R1-folded on a local branch (`051c055`; not pushed, no PR yet). R1 found 3 MATERIALs, all folded, so an R2 range check on `96b235b..051c055` is next.** `main` is at `ccfec03`, and no PRs are open. All 8 personas are `started` with checks passing.

**Asked and decided:** nothing. Nothing this session was marked Alex's.

**Done this session:**

- **Build** (orchestrator, `96b235b`): Session 60's review decisions went into `docs/SESSION-HANDOFF.md`.
  - §1 row 1 → 40k above the context at load.
  - A §9 context-at-load field.
  - §5 step 1 → fetch, then read `origin/main`'s copy.
  - The PPPP (§6), SSSS (§9) and YYYY (§5) harvests.
  - Siblings: `AGENTS.md:96` and `RATIONALIZATIONS.md:103`, both said "above 100k".
  - `docs/GIT.md`'s blast-radius list names all three files, so the surrogate was mandatory.
- **R1** (range `main...96b235b`, both isolated): DA 0 BLOCKING / 3 MATERIAL / 3 LOW (+2 Nit, 3 FYI); surrogate 0 / 3 / 7 (+2 FYI). Reports: `.claude/research/workflow-series/handoff-r1/`.
  - **Converged, verified at source:**
    - Tags said "(Alex …)" for the context-at-load field, the `origin/main` read and no-backfill. In `8e27f4c:PROGRESS.md` Alex decided only row 1 and delegated the rest (LLLLL).
    - §1's "why" cited Sessions 60–66's loads (~78–95k) for a decision made on Sessions 57–60's (~87–95k: 88.6, 86.9, 93.2, 94.9k) (MMMMM).
  - **DA M3:** §5's `origin/main` read goes stale under §3's own open-PR exception (#110–#112 bundled `PROGRESS.md`).
  - Sibling sweep clean: no "100k" rule or old prompt text survives outside `PROGRESS.md` and `docs/history/`.
- **R1 fold** (`doc-fixer`, per `handoff-r1/fold-brief.md`, `051c055`): F1–F9 applied verbatim.
  - The builder reported Prettier and the `AGENTS.md` script suite (`typecheck:scripts`, `test:scripts`, `check:agents`, `check:rulebook`) passing. **Orchestrator verified only the commit list**; R2 checks the content.
  - The brief's "Dismissed" section carries into the PR body.

**In flight:** nothing running.

**Next, and open questions for Alex:** nothing waiting on Alex.

**Cleanup:** both R1 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. `docs/session-handoff-review` is kept (unpushed work). Session 61 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~140k tokens at handoff (usage tool; 5-hour window 38%, weekly 50%, Fable weekly 4%). Context at load: 84.6k (usage tool), so row 1 fired at ~124.6k. Tool schemas at load: 49.4k (system tools 30.2k plus MCP tools 19.2k).

- **Trigger:** row 1, a phase boundary (R1 fold committed) at 134.1k.
- **What grew context most:**
  - The ~85k loaded start. It included the full `PROGRESS.md` (~11k) and SESSION-HANDOFF (~6k).
  - The two R1 hand-backs (~4k).
  - Reading the Session 60 entry for the spec (~3k).
  - Writing the fold brief (~3k).
- **Subagent tokens:** DA R1 105k, surrogate R1 125k, R1 fold 51k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 66):**

- **LLLLL — KKKKK recurred in the PR harvesting the handoff rules.** Before review, the orchestrator caught one trailing tag. It still tagged three delegated calls "(Alex, 2026-09-27)", because the Session 60 entry's "Asked and decided (Alex, …)" header files Claude's delegated calls under Alex's name. Both reviewers caught it. An "Asked and decided" block should separate what Alex decided from what Claude decided under his delegation. → `docs/SESSION-HANDOFF.md` §6 (see the loading instructions).
- **MMMMM — A rationale cited later data than the decision it explains.** "~78–95k (Sessions 60–66)" was given as the reason for a Session 60 decision taken on Sessions 57–60's figures, and "~10k of work" didn't hold at the new range's low end. When writing why a past decision was made, cite the data the decision had. → none (observation).
- **NNNNN — The review-worktree isolation guard refused writes containing literal git command text.** Both reviewers had to cite commits in prose or shorthand ("S:<sha>"). The content was unaffected. → memory (`harness-and-tooling-gotchas.md`).

### Session 67 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`** (YYYY, GGGGG).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `ccfec03`), `git status`, `gh pr list` (expect none open), and `git log --oneline main..docs/session-handoff-review` (expect 2 commits, ending `051c055`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: finish `docs/session-handoff-review`.**
  1. Check out the branch; merge `origin/main` if it has moved.
  2. Harvest LLLLL first, as its own commit on the branch, so R2 reviews it. In §6's entry-shape list, "Asked and decided" gains a clause: split "Alex decided" from "Claude decided under Alex's delegation" and tag each accordingly.
  3. Run the R2 range check on `96b235b..HEAD`, DA and surrogate in parallel and isolated.
     - Both check every item F1–F9 in `handoff-r1/fold-brief.md` (applied as settled, true at source, no new false absolute), plus the LLLLL commit.
     - Per UUUU/XXXX: git only in their own worktree; they detach at the branch HEAD; reports are written there and `cp`'d to `handoff-r2/`. NNNNN: reports may cite commits in prose.
     - 0 BLOCKING/MATERIAL → the disclosed LOW pass, then self-review (`docs/SELF-REVIEW.md`).
  4. Run the full pre-push suite (tests via `pnpm -r --no-bail --if-present run test`, WWWW), plus the `AGENTS.md` script suite.
  5. Push, and open the PR: `📝 docs(handoff): apply §9's first review — row 1 relative to context at load`. Take the type label from `docs/GIT.md`.
     - Body: the fold brief's "Dismissed" items.
     - Post the surrogate reports (R1 on) as one comment.
     - HHHHH: the push and `gh pr create` may need Alex's word in chat. Batch them.
- **Decision branches:**
  1. If the R2 loop reaches R4, ask Alex (`docs/DEVELOPMENT.md` §Review Gate).
- **Carry-overs:**
  - WWWW into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - IIIII rides in the next PR that touches `REVIEW-PATTERNS.md`.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream. Candidates are in `git show 3abde05:PROGRESS.md`'s Session 52 entry. Confirm the order with Alex.
  - NOTICED items for a later cleanup PR: #118's (its body), and `AGENTS.md:37`'s "§Node-native TS execution…" anchor, which points to a bold lead-in, not a heading (surrogate R1 FYI 12).
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 67:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 65

Updated 2026-09-28 end-Session-65 — **`docs/glossary-thinning` is open as [PR #118](https://github.com/Pushedskydiver/moe/pull/118), not merged (Alex merges). R3 found no BLOCKING issues and no code MATERIAL; the LOW pass was applied.** CI hadn't started at handoff. `main` is at `430e922`. All 8 personas are `started` with checks passing.

Update (2026-09-28): Alex merged #118 as `029a9bf`, with no review comments. The local branch is deleted.

**Asked and decided:** nothing. Nothing this session was marked Alex's.

**Done this session:**

- **Merged `origin/main`** (#117) into the branch (`8306c05`).
  - `review-queue-sweep.ts`, `review-queue-repository.ts` and `schema.ts` took #117's side whole.
  - `ARCHITECTURE.md` kept the branch's list format, with #117's two phrases applied.
  - After the merge, the branch no longer touched `packages/core`.
- **GLOSSARY scoped to #117** (`288910f`):
  - `:48` (was `:54` on `main`) now reads "the rows created since the last completed sweep", describes `sweep_state` as the window's upper bound, and names the TSDoc's exceptions. "Only advances" became "only updates".
  - `:46`'s "has no cron infrastructure" became "had no scheduled-job infrastructure at 3.5".
- **Pre-push suite at `288910f`:** build, lint, typecheck, format and knip passed. Every test passed except `packages/core`'s 20 DB-backed files (`DATABASE_URL is not set`, plus the teardown `TypeError`s).
- **R3** (range `04c6ec3..288910f`, both isolated):
  - DA: 0 BLOCKING / 1 MATERIAL / 1 LOW (+3 FYI). Surrogate: 0 / 0 / 1 (+5 FYI). Reports: `.claude/research/workflow-series/pr5-gloss-r3/`.
  - Every R2 fold item was confirmed, and so was the merge resolution: no #117 wording lost, nothing reverted.
  - DA's MATERIAL was about the _planned PR body and labels_: `core` was stale after the merge, and so were the R1/R2 carry items #117 had fixed. It was addressed in the body, so no R4 was needed. (The orchestrator had noted both points before the report arrived.)
- **LOW pass** (orchestrator, `c1a7fe2`):
  - GLOSSARY's "— Alex confirmed" was re-scoped to the 3.5 design choice (DA L1; surrogate FYI 3 flagged it independently).
  - "A real answer racing the sweep always wins" was false in GLOSSARY and in `findStaleUnresolvedConfirmingQuestions`' TSDoc: one CAS, first claim wins, and a later reaction is ignored (`handle-reaction-added.ts:111-117`). Verified at source and rewritten. That brought `core` back as a label.
- **Self-review:** clean. **Tokens** (one run): GLOSSARY 28,857 → 21,476 → 18,050; ARCHITECTURE 13,998 → 10,193 → 11,126; the DA-REVIEW control was 9,712 on both sides.
- **PR #118** opened with labels `chore`, `server`, `github` and `core`. The body covers the merge, the superseded R2 items, the disclosures and the LOW pass. The surrogate R1–R3 reports are posted as one comment. The PR is bound to the CI monitor.

**In flight:** PR #118's CI.

**Next, and open questions for Alex:**

- ~~**[ALEX]** Merge #118.~~ Done (`029a9bf`).

**Cleanup:** both R3 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `docs/glossary-thinning` is kept (open PR). Session 60 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~175k tokens at handoff (usage tool; 5-hour window 24%, weekly 48%, Fable weekly 4%). Context at load: 94.9k, so row 1 fired at ~135k.

- **Trigger:** row 2 (the 150k soft line), reached at the R3 digest (161.6k). Row 1 had already passed at ~135k mid-R3. The unit in progress (the glossary PR) was finished, then this handoff.
- **What grew context most:**
  - The ~95k loaded start. It included the full `PROGRESS.md` (~12k) and SESSION-HANDOFF (~6k).
  - The oversized conflict diff dumps (~5k), before switching to marker-only greps.
  - Brief §4–§5 (~6k).
  - The two R3 hand-backs (~3k).
  - The pre-push triage (~2k).
- **Subagent tokens:** DA R3 127k, surrogate R3 112k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 65):**

- **JJJJJ — A merge that takes the other side whole can void the PR's planned labels and carry items.** Taking #117's side removed every `packages/core` change, so the `core` label and three carried PR-body items went stale. After any merge, derive labels from `git diff --stat origin/main..HEAD` and re-check each carried body item against HEAD. → none (instance of `REVIEW-PATTERNS.md`'s "a landing falsifies forward references").
- **KKKKK — Appending a qualifier before a trailing attribution tag widens what the tag attributes.** "…left off, save for the exceptions … — Alex confirmed" made Alex appear to confirm #117's exceptions. Two reviewers caught it independently. When editing a clause that ends in "(Alex confirmed)", keep the tag next to the thing he confirmed. → none (observation).

### Session 66 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`** (YYYY, GGGGG).
  - `git log --oneline -3 origin/main` (expect `029a9bf` (#118) on top of `23a7b1e`, or later), `git status`, and `gh pr list` (expect none open).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: the SESSION-HANDOFF PR**, as specified in the Session 61 entry (once it archives: `git show 430e922:PROGRESS.md`). Its own branch.
  - Row 1 → load + 40k.
  - The "context at load" field.
  - Prompt step 1 → `origin/main` (GGGGG is supporting evidence).
  - The PPPP, SSSS and YYYY harvests.
  - Check whether `docs/GIT.md`'s blast-radius list names SESSION-HANDOFF. If it does, the surrogate is mandatory.
  - IIIII rides in the next PR that touches `REVIEW-PATTERNS.md`.
- **Decision branches:**
  1. If the SESSION-HANDOFF PR's review loop reaches R4, ask Alex (`docs/DEVELOPMENT.md` §Review Gate).
- **Carry-overs:**
  - WWWW into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream. Candidates are in `git show 3abde05:PROGRESS.md`'s Session 52 entry. Confirm the order with Alex.
  - #118's NOTICED items (its body) are candidates for a later cleanup PR.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 66:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 64

Updated 2026-09-28 end-Session-64 — **`fix/review-queue-sweep-rereport` is open as [PR #117](https://github.com/Pushedskydiver/moe/pull/117), not merged (Alex merges). R3 came back with 0 BLOCKING / 0 MATERIAL, and the LOW pass was applied.** At handoff CI showed 4 passing, 1 pending. The DB-backed tests' first-ever CI run was not yet confirmed. `docs/glossary-thinning` is unchanged at `c8cd765` (R3 still due). All 8 personas are `started` with checks passing.

Update (2026-09-28): #117's CI went green, 5/5. The DB-backed tests ran for the first time: all 57 `packages/core` test files passed, including `review-queue-repository.test.ts` (15 tests). The PR is `BEHIND` `main`, by the handoff commit only.

Update (2026-09-28): Alex merged #117 as `77e6b77`, with no review comments. Both trades stand as shipped (no guard, no settle delay, no warn log), so decision branch 3 is closed. The local branch is deleted.

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
  - `git log --oneline -3 origin/main` (expect `77e6b77` (#117) on top of this handoff's `c75418c`, or later), `git status`, and `gh pr list` (expect none open; #117 merged as `77e6b77`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: finish `docs/glossary-thinning`**, per the Session 62 entry's loading instructions (step "Then: finish `docs/glossary-thinning`"). R3 on `04c6ec3..` the post-merge HEAD, so the conflict resolution and the GLOSSARY `:54` edits are inside the range, then the PR. Labels: `chore`, `server`, `github`, `core`.
  - #117 is merged, so merge `origin/main` into the branch first and resolve the conflicts in `review-queue-repository.ts`, `schema.ts`, `review-queue-sweep.ts` and `sender-trigger-cache.ts` in favour of #117. Also take #117's `ARCHITECTURE.md:20` and `sweep-state.ts` wording if they conflict.
  - GLOSSARY `:54`: scope "never misses a row" / "double-reports" to the sweep TSDoc's four exceptions (decision branch 2). Surrogate R3 FYI A found three more phrases there that #117 fixed everywhere else: "the codebase has no scheduled-job infrastructure" (false: the pull loop's `setInterval`), "since the persona's last sweep", and "'last swept at' timestamp". Fix them in the same pass.
- **Then the SESSION-HANDOFF PR**, as specified in the Session 61 entry: row 1 → load + 40k, the "context at load" field, prompt step 1 → `origin/main` (GGGGG is supporting evidence), and the PPPP, SSSS and YYYY harvests. IIIII rides in the next PR that touches `REVIEW-PATTERNS.md`.
- **Decision branches:**
  1. If the glossary R3 finds BLOCKING/MATERIAL, fold it and run R4. Reaching R4 means ask Alex (`docs/DEVELOPMENT.md` §Review Gate).
  2. GLOSSARY `:54` on the glossary branch: see above.
  3. Closed: #117 merged with both trades as shipped.
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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
