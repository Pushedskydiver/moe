# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.md` for the mechanics).

## Next workstreams (after Session 68)

Updated 2026-09-28 end-Session-68 — **[PR #119](https://github.com/Pushedskydiver/moe/pull/119) (`docs/session-handoff-review`) is open with all 5 CI checks passing, and it's waiting on Alex's merge. The A4 cite fix is built, R1-reviewed and R1-folded on a local branch (`fix/vision-latency-cites`, `48efbc0`; not pushed, no PR yet). An R2 range check on `4217a18..48efbc0` is next.** `main` is at `440b9e9` plus this handoff. All 8 personas are `started` with checks passing.

Update (2026-09-28): Alex merged #119 (`e3ac3a4`). The local and remote `docs/session-handoff-review` branches are gone.

**Asked and decided:**

- Alex decided: nothing new this session. A4's "fix the cites, don't add a target" is Alex's earlier call.
- Claude decided under Alex's delegation (2026-09-28):
  - Opened #119 and started A4 without asking. The Session 67 entry marked nothing as Alex's beyond the push and `gh pr create`, and neither needed his word.
  - Graded all four converged R1 findings at the higher of the two reviewers' severities (convergence rule).
  - Kept the surrogate's #7 and #8 and DA's FYI 1 out of A4's scope as NOTICED items (see Carry-overs).

**Done this session:**

- **#119** (`docs/session-handoff-review`):
  - Merged `origin/main` (`f16eafb`).
  - Self-review over `main...HEAD`: clean. The three-way consistency check covered §1 row 1, AGENTS.md and RATIONALIZATIONS.md.
  - Pre-push suite: every step passed except `@moe/core`'s 20 DB-backed test files (no `DATABASE_URL`, as expected). The test step ran on its own (PPPPP).
  - Pushed and opened the PR, labelled `chore`. The body carries the three fold briefs' "Dismissed" items, including R3's reversal of R1's `AGENTS.md:7` dismissal, and discloses that the R3 LOW pass got no further round.
  - The R1–R3 surrogate reports are posted as one comment.
  - CI: 5/5 passing, verified with `gh pr checks`.
- **A4 cite fix** (`fix/vision-latency-cites`, from `main` at `440b9e9`):
  - Scope traced with `git log -S` to `git show 3abde05:PROGRESS.md`. Three sites cited "§6.4's sub-10s casual-reply latency target". VISION has never stated one: scaffold `1db8aa8`'s §6.4 has none.
  - **Build** (orchestrator, `4217a18`): `docs/VISION.md:317`, `packages/agents/src/create-anthropic-client.ts:9` and `apps/server/src/create-pull-loop-behavior-deps.ts:40`. Same suite result as #119.
  - **R1** (range `main...4217a18`, both isolated): DA 0 BLOCKING / 2 MATERIAL / 2 LOW (+2 Nit, 3 FYI); surrogate 0 / 3 / 4 (+2 FYI). Reports: `.claude/research/workflow-series/a4-cites-r1/`.
    - Both reviewers converged on every MATERIAL and LOW.
    - Two same-file siblings still carried the phantom target: the `createAnthropicClient` TSDoc and `record-persona-replay.ts:95`.
    - Two comments falsely said "every production call site keeps the 20s default", but the pull loop overrides it with 120s.
    - The test title at `create-anthropic-client.test.ts:17` still used the old wording.
    - VISION's new clause was an unsourced judgement.
    - All verified at source: three non-test callers, and only `start-slack-listener.ts:301` keeps the default.
  - **R1 fold** (`implementer`, per `a4-cites-r1/fold-brief.md`, `48efbc0`): F1–F6 were applied as written. The orchestrator read the word diff. The worker ran prettier and eslint on the touched files and the `@moe/agents` tests (323 passing), and used its own Sonnet trailer.

**In flight:** nothing running.

**Next, and open questions for Alex:** merge #119. Nothing else is waiting on him.

**Cleanup:** both R1 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. `docs/session-handoff-review` is kept (open PR), and so is `fix/vision-latency-cites` (unpushed work). Session 63 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~150k tokens at handoff (usage tool; 5-hour window 10%, weekly 52%, Fable weekly 4%). Context at load: 80.5k (usage tool), so row 1 fired at ~120.5k. Tool schemas at load: 49.9k (system tools 30.7k plus MCP tools 19.2k).

- **Trigger:** row 1, a phase boundary (the A4 R1 fold committed) at ~146k. The PR opening at 109.9k came before the threshold.
- **What grew context most:**
  - The ~80k loaded start.
  - Self-review and suite output for #119 (~15k), including the full SELF-REVIEW checklist (~5k).
  - Tracing A4's scope and its sites (~8k).
  - The two R1 hand-backs (~4k), plus the fold brief (~2k).
- **Subagent tokens:** DA R1 85k, surrogate R1 112k, R1 fold 28k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none. A4's scope did have to be traced through history, though (QQQQQ).

**Lessons (Session 68):**

- **QQQQQ — A carry-over with no scope pointer survived five handoffs.** "The A4 cite-fix PR (Alex: fix the cites)" was carried with no pointer from Session 64 to 68, although §6's carry-over rule exists to prevent exactly this. Finding its three sites took `git log -S` back to `3abde05`. Before copying a carry-over forward, check it names where its scope is written. → none (a recurrence under `docs/SESSION-HANDOFF.md` §6; the rule is already written).
- **RRRRR — A named site list is a claim, not the scope.** The build fixed exactly the three sites the old entry named. Both reviewers found the same phantom target 16 lines further down one of those files, in a sibling script and in a test title. When fixing a wrong cite, grep for the concept ("latency target"), not only the quoted phrase. → none (an instance of `docs/REVIEW-PATTERNS.md` §Over-correction's untouched-sibling mode).

### Session 69 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`**.
  - `git log --oneline -3 origin/main` (expect #119's squash `e3ac3a4` on top of this handoff, plus this update), `git status`, `gh pr list` (expect none open), and `git log --oneline main..fix/vision-latency-cites` (expect 2 commits, ending `48efbc0`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: finish `fix/vision-latency-cites` (A4).**
  1. Check out the branch. If `origin/main` has moved, merge it.
  2. Run the R2 range check on `4217a18..HEAD`, with DA and surrogate in parallel and isolated.
     - Both check every item F1–F6 in `a4-cites-r1/fold-brief.md`: applied as settled, true at source, no new false absolute.
     - Per UUUU/XXXX: git only in their own worktree; they detach at the branch HEAD; reports are written there and `cp`'d to `a4-cites-r2/`. NNNNN: reports may cite commits in prose.
     - 0 BLOCKING/MATERIAL → the disclosed LOW pass, then self-review.
  3. Run the pre-push suite: `pnpm build`, then the test step on its own (WWWW, PPPPP), then lint, typecheck, format:check and knip. The script suite doesn't apply: no `AGENTS.md`, `.claude/` or root-config path is touched.
  4. Push, and open the PR: `🐛 fix(docs): drop the phantom VISION §6.4 latency-target cites`, labels `fix`, `agents`, `server`.
     - Body: the fold brief's "Dismissed / PR body" items.
     - Post the surrogate reports as one comment.
     - `docs/VISION.md` is blast-radius, so Alex merges.
- **Decision branches:** none. (#119 merged after handoff.)
- **Carry-overs:**
  - WWWW and PPPPP go into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - IIIII rides in the next PR that touches `REVIEW-PATTERNS.md`.
  - After A4: the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream. Candidates are in `git show 3abde05:PROGRESS.md`'s Session 52 entry. **Alex:** confirm the order.
  - NOTICED items for a later cleanup PR:
    - #118's (its body).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor, which points to a bold lead-in, not a heading (surrogate R1 FYI 12 in `handoff-r1/`).
    - A4 R1's three out-of-scope findings, unverified, listed under "Dismissed / PR body" in `a4-cites-r1/fold-brief.md`: `VISION.md:309`'s stale call-site list, `create-pull-loop-behavior-deps.ts:25-26`'s `commitAsTicket` claim, and `REVIEW-PATTERNS.md:67`'s §6.4 delegation.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 69:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 67

Updated 2026-09-28 end-Session-67 — **`docs/session-handoff-review` has cleared its review gate on a local branch (`4a231e0`; not pushed, no PR yet). R2 and R3 are folded, and the final LOW pass is committed. Self-review, the pre-push suite, the push and the PR come next.** `main` is at `abb2b96` plus this handoff, and no PRs are open. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided: nothing.
- Claude decided under Alex's delegation (2026-09-28):
  - Graded R2's converged `:76` finding MATERIAL (DA called it LOW, the surrogate MATERIAL), per the convergence rule.
  - Declined DA R3's FYI to put a `<branch>` placeholder in §5's prompt block.
  - Left the Session 66 entry's "Asked and decided: nothing" unedited, since §3 forbids editing an earlier entry.

**Done this session:**

- **Merge and LLLLL** (`2f023a3`, `b0b0aa3`): merged `origin/main` into the branch. §6's "Asked and decided" now splits Alex's decisions from Claude's delegated calls. The "three delegated calls" claim was checked at `96b235b` before committing.
- **R2** (content range `96b235b..b0b0aa3`, both isolated): DA 0 BLOCKING / 0 MATERIAL / 3 LOW (+3 Nit, 3 FYI); surrogate 0 / 1 / 5. Reports: `.claude/research/workflow-series/handoff-r2/`.
  - **Converged:** §5 said "the handoff notice" names the branch, but only the paste-in prompt reaches the next session (graded MATERIAL). Four more converged: "before the fifth", "first entry to record it", the no-backfill attribution, and `AGENTS.md:96` missing "deploy verified".
  - All verified at source.
- **R2 fold** (`doc-fixer`, per `handoff-r2/fold-brief.md`, `240ef03`): F1–F6. The orchestrator read the word diff.
- **R3** (range `b0b0aa3..240ef03`): DA 0 / 0 / 2 (+1 Nit, 4 FYI); surrogate 0 / 0 / 4. Reports: `handoff-r3/`. Both LOWs that the reviewers converged on came from wording in the orchestrator's own R2 brief (OOOOO).
- **R3 LOW pass** (`doc-fixer`, per `handoff-r3/fold-brief.md`, `4a231e0`): L1–L3.
  - `:76`'s new absolute is gone, and `:130` is split into two sentences, dropping the unsourced "under the same delegation".
  - `AGENTS.md:7` now names which copy of `PROGRESS.md` to read.
  - **Orchestrator read the content diff; no further round, disclose in the PR.**
- **Suites on `b0b0aa3`:** build, lint, typecheck, format:check and knip all passed, as did the `AGENTS.md` script suite. The one failure was `@moe/core`'s DB-backed tests, because `DATABASE_URL` isn't set locally. The folds after it touched prose only. `doc-fixer` reported the script suite passing on both folds.
- **Memory:** `autonomous-run-handoff.md` gained the open-PR exception (surrogate R3 L2), and `independent-review-angle-convergence.md` gained this PR's instance.

**In flight:** nothing running.

**Next, and open questions for Alex:** nothing waiting on Alex beyond HHHHH's push and `gh pr create`.

**Cleanup:** all four R2/R3 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. `docs/session-handoff-review` is kept (unpushed work). Session 62 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~130k tokens at handoff (usage tool; 5-hour window 45%, weekly 51%, Fable weekly 4%). Context at load: 75.3k (usage tool), so row 1 fired at ~115.3k. Tool schemas at load: 49.5k (system tools 30.2k plus MCP tools 19.2k).

- **Trigger:** row 1, a phase boundary (the R3 LOW pass committed) at 122.3k.
- **What grew context most:**
  - The ~75k loaded start, ~9k below Session 66's 84.6k. Only the loading-instructions block of `PROGRESS.md` was read in full.
  - The four R2/R3 hand-backs (~7k).
  - The two fold briefs (~3k).
  - The R2 source reads (~3k).
- **Subagent tokens:** DA R2 101k, surrogate R2 110k, R2 fold 33k, DA R3 83k, surrogate R3 81k, R3 fold 26k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 67):**

- **OOOOO — The orchestrator's own fold brief caused R3's LOWs.** Both reviewers flagged two phrases the R2 brief had added: a new absolute ("the prompt is all the next session receives") and an unsourced attribution ("under the same delegation"). A brief's replacement text is new claim text, and it needs the same verification as the findings it folds. → none (instance of `docs/REVIEW-PATTERNS.md` §Over-correction's third failure mode).
- **PPPPP — `&&`-chaining the pre-push suite after the test step skips the rest on the known local DB failure.** `pnpm -r --no-bail … test` exits non-zero on `@moe/core`'s DB-backed files without `DATABASE_URL`. That silently skipped lint, typecheck, format:check, knip and the script suite until they were re-run separately. Run the test step on its own. → rides WWWW's `docs/DEVELOPMENT.md` §Quick Reference carry-over.

### Session 68 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`** (YYYY, GGGGG).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `abb2b96`), `git status`, `gh pr list` (expect none open), and `git log --oneline main..docs/session-handoff-review` (expect 6 commits, including the merge, ending `4a231e0`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: finish `docs/session-handoff-review`.**
  1. Check out the branch, and merge `origin/main` (this handoff moved it).
  2. Self-review per `docs/SELF-REVIEW.md` over `main...HEAD` (AGENTS.md, `docs/RATIONALIZATIONS.md`, `docs/SESSION-HANDOFF.md`).
  3. Run the pre-push suite: `pnpm build`, then `pnpm -r --no-bail --if-present run test` **as its own step** (WWWW, PPPPP), then lint, typecheck, format:check, knip, and the `AGENTS.md` script suite. The only expected failure is the DB-backed core tests (no local `DATABASE_URL`).
  4. Push, and open the PR: `📝 docs(handoff): apply §9's first review — row 1 relative to context at load`. Take the type label from `docs/GIT.md`.
     - Body: the "Dismissed" items from the fold briefs in `handoff-r1/`, `handoff-r2/` and `handoff-r3/`. Also disclose that the R3 LOW pass (`4a231e0`) got no further review round, and that the orchestrator read its content diff.
     - Post the surrogate reports (R1–R3) as one comment.
     - HHHHH: the push and `gh pr create` may need Alex's word in chat. Batch them.
  5. Alex merges.
- **Decision branches:**
  1. If self-review finds a BLOCKING or MATERIAL, fold it and run a range check before pushing.
- **Carry-overs:**
  - WWWW and PPPPP go into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - IIIII rides in the next PR that touches `REVIEW-PATTERNS.md`.
  - The A4 cite-fix PR (Alex: fix the cites).
  - Then the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream. Candidates are in `git show 3abde05:PROGRESS.md`'s Session 52 entry. Confirm the order with Alex.
  - NOTICED items for a later cleanup PR: #118's (its body), and `AGENTS.md:37`'s "§Node-native TS execution…" anchor, which points to a bold lead-in, not a heading (surrogate R1 FYI 12).
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 68:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 66

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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
