# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.md` for the mechanics).

## Next workstreams (after Session 70)

Updated 2026-09-28 end-Session-70 — **A4 shipped: [PR #120](https://github.com/Pushedskydiver/moe/pull/120) is merged (`dd4747a`). The Hook PR is built on a local branch (`chore/fly-guard-hook`, `6ba7a15`; not pushed, no PR yet), and its R1 review is next.** `main` is at `dd4747a` plus this handoff, and no PRs are open. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided (2026-09-28):
  - The post-A4 order is the Hook PR, then the O10 Prettier chore, then the chief-clancy doc-port.
  - The doc-port's scope is `docs/roles/`, plus `LIFECYCLE.md` and `VISUAL-ARCHITECTURE.md` "if you think [they] make sense", and "any others you see fit".
- Claude decided under Alex's delegation (2026-09-28):
  - The hook asks only on mutating `fly secrets` subcommands (`set`, `unset`, `import`, `deploy`, `sync`), not on `list` or bare `secrets`. This follows the PCR reference hook's narrowness argument: a prompt that fires on harmless reads trains people to ignore it.
  - Recorded in the brief, not yet reviewed: a false positive (`echo "fly deploy"` asks) is accepted over a shell tokenizer, and the hook fails open.

**Done this session:**

- **A4 (#120):**
  - Merged `origin/main` (`9b6e742`).
  - Self-review over `main...HEAD` was clean. The sweep for "latency target", "sub-10s" and "§6.4" found only the operating-rhythm cites.
  - Pre-push suite: build, lint, typecheck, format:check and knip passed. Every test passed except `@moe/core`'s 20 DB-backed files (no local `DATABASE_URL`). The test step ran on its own (PPPPP).
  - Pushed and opened the PR, labelled `fix`, `agents` and `server`. The body carries the R1–R3 "Dismissed / PR body" items as a NOTICED list, and discloses that the R3 LOW pass got no further round. The surrogate R1–R3 reports are posted as one comment.
  - Alex merged it (`dd4747a`). The local branch is deleted; the remote one was already gone.
- **Hook PR build** (`implementer`, per `.claude/research/workflow-series/hook-pr/brief.md`, `6ba7a15`):
  - Files: `scripts/guard-fly.ts` (110 lines), its test (148 lines), `.claude/settings.json`, `.gitignore` (`!.claude/settings.json`, and a reworded comment the brief didn't ask for) and one sentence in `AGENTS.md`.
  - The model is PCR's `scripts/guard-destructive-git.ts`.
  - Worker-reported: the script suite, lint, format:check and knip pass (100 script tests). A piped-JSON smoke test asks on `cd x && fly deploy …` and stays silent on `fly status`. No real `fly` command was run.
  - **The orchestrator read the config/AGENTS.md diff and the script header only. R1 checks the rest.**
  - Worker caveats: the child-process tests never ran red (written together with `main()`). The "restarts its Machines" clause is verified at `docs/OPERATIONS.md` for `fly secrets set` only.

- **§9 second review, evidence base** (read-only `general-purpose` agent; the orchestrator saved its report from the transcript because the harness refused the subagent's own write): `.claude/research/workflow-series/s9-review-2/report.md`. It covers n = 10 sessions (60–69) over two days, and nothing below has been verified at source by the orchestrator yet:
  - Row 1 fired in 8 of 10 sessions, a median +9.3k past its line. Row 2 fired in 2 (Sessions 60 and 65), and row 3 never did (max 175k). Work after load had a median of 56k. No §11 revisit trigger fired.
  - The recommendations are: no §1 or §10 change; three §9 field tweaks (the fire-point figure, a widened clarifying-question field, handoff tokens to 0.1k); and read only the newest entry (UUUUU).
  - It also recommends giving §8's "rides the next PR that touches X" an end date. WWWW has been carried 11 handoffs and IIIII 6, because no PR touches their docs.
  - Its "ask the 14-handoff order question" was answered this session.

**In flight:** nothing running.

**Next, and open questions for Alex:**

- **[ALEX]** Confirm the §9 review's "no §1 threshold change" (row 1 was his call). The data shows no quality signal either way.
- **[ALEX, veto]** §8's "rides the next PR" rule gets an end date: past its entry's archival, a harvest gets its own small PR. It lands in a blast-radius doc, so it's Claude's call unless Alex vetoes it.

**Cleanup:** the local `fix/vision-latency-cites` branch was deleted (merged). `git worktree list` shows only the primary checkout. `chore/fly-guard-hook` is kept (unpushed work). Session 65 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~150k tokens at handoff (usage tool; 5-hour window 17%, weekly 53%, Fable weekly 4%). Context at load: 94.5k (usage tool), so row 1 fired at ~134.5k. Tool schemas at load: 50.3k (system tools 30.7k plus MCP tools 19.6k).

- **Trigger:** row 1, a phase boundary (the Hook PR build committed) at 146.9k. The #120 PR opening at 117.3k came before the threshold.
- **What grew context most:**
  - The ~94k loaded start. The whole of `PROGRESS.md` was read again (~10k), despite Session 69's note (UUUUU).
  - PR prep: the SELF-REVIEW checklist (~5k), the word diff (~3k) and the fold briefs' PR-body items (~2k).
  - Scoping the hook: its approval entry, and PCR's reference script (~5k).
  - The hook brief (~2k) and the build hand-back (~2k).
- **Subagent tokens:** Hook build 46k. §9 data agent 146k.
- **§9 review:** evidence gathered this session (see Done). Applying it is Session 71's work.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 70):**

- **UUUUU — The load instruction said "read the newest entry, not the whole file", but its own command prints the whole file.** `git show origin/main:PROGRESS.md` overflowed the tool output cap, and the persisted file was then read in full (~10k, the same cost Session 69 recorded). A command that stops at the first older entry does what the instruction means: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`. → `docs/SESSION-HANDOFF.md` §5 (the paste-in prompt's step 1), in the next PR that touches it.
- **VVVVV — The fleet check guessed persona App names** (`moe-dev`, `moe-jordan`, `moe-sam`) instead of deriving them from `fly.*.toml`, as §6 says. Three failed calls. Loop over `ls fly.*.toml`. → none (the rule is already written).
- **WWWWW — zsh reads `$h:P…` as a history modifier.** `git show $h:PROGRESS.md` expanded to `…5f63516ROGRESS.md`. Brace the variable: `"${h}:PROGRESS.md"`. → memory (`harness-and-tooling-gotchas.md`).

### Session 71 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'` (UUUUU).
  - `git log --oneline -3 origin/main` (expect this handoff on top of `dd4747a`), `git status`, `gh pr list` (expect none open), and `git log --oneline main..chore/fly-guard-hook` (expect 1 commit, `6ba7a15`).
  - `fly status -a moe-<persona>` for each `fly.*.toml` (VVVVV).
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: the Hook PR's review gate** (`chore/fly-guard-hook`).
  1. Merge `origin/main` into the branch (this handoff moved it).
  2. R1 over `main...HEAD`: DA and copilot-surrogate in parallel, isolated (UUUU/XXXX, NNNNN). The surrogate is mandatory, since the diff is 278 lines and touches `AGENTS.md`. Point both reviewers at `hook-pr/brief.md`, and ask them to check:
     - whether the `AGENTS.md` sentence ("the human confirming that prompt is the deploy authorisation") overstates what the hook establishes;
     - the unrequested `.gitignore` comment edit;
     - whether the secrets reason text overclaims for `unset`, `import` and `sync`;
     - the regex's false negatives (e.g. `env FOO=1 fly deploy`, a newline-separated script, `sh -c 'fly deploy'`).
  3. Fold with `implementer`, then run the R2 range check, per `docs/DEVELOPMENT.md` §Review Gate.
  4. Self-review, then the pre-push suite (the test step on its own, PPPPP) **plus** the script suite (`AGENTS.md`, a root script and root config are touched).
  5. Push, and open the PR: take the type and labels from the commit (`📦 chore(hooks): …`) and `docs/GIT.md`. `AGENTS.md` is blast-radius, so Alex merges.
  6. After the merge, verify it live. A new session on `main` should raise a confirmation prompt for the harmless `echo "fly deploy"`, which is a false positive by design. Never run a real `fly deploy`.
- **Then the §9 review PR, bundled with the overdue harvests** (its own branch). Evidence: `s9-review-2/report.md`.
  - Spot-check its figures at source before relying on them: at least three sessions' rows, plus the WWWW and IIIII carry counts.
  - Apply recommendations 2–8 that survive the check, in `docs/SESSION-HANDOFF.md`: the §9 fields, §5 step 1's newest-entry read (UUUUU), and §8's end date (unless Alex vetoed it).
  - Bundle in the overdue harvests, which is the §8 end date applied to its own backlog: WWWW and PPPPP → `docs/DEVELOPMENT.md` §Quick Reference; IIIII → `REVIEW-PATTERNS.md`. Recommendation 11 (brief-template lines for the sibling-sweep and fold-text classes) may ride the same `DEVELOPMENT.md` edit.
  - All of these are blast-radius docs, so the review gate applies, the surrogate is mandatory, and Alex merges.
  - If the bundle looks over ~1500 diff lines or mixes too much, split it (memory: chunk-splitting).
- **Decision branches:**
  1. If the Hook R1 loop reaches R4, ask Alex (`docs/DEVELOPMENT.md` §Review Gate).
  2. **[ALEX]** The §1 no-change confirmation and the §8 veto (see "Next" above), if they're still unanswered at load.
- **Carry-overs:**
  - After the Hook PR:
    - The O10 Prettier chore PR. Scope: `git show 3abde05:PROGRESS.md` ("[ALEX] O10").
    - The chief-clancy doc-port. Scope: `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md`, plus Alex's decision above. Mechanics: `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - WWWW, PPPPP, IIIII and UUUUU: scheduled into the §9 review PR above.
  - NOTICED items for a later cleanup PR:
    - #118's (its body).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`).
    - #120's "Noticed but not touching" list (its body). The replay-harness count drift is one root and can be one commit.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 71:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 69

Updated 2026-09-28 end-Session-69 — **The A4 cite fix (`fix/vision-latency-cites`, `f057ef1`; not pushed, no PR yet) has cleared its review gate. R2 found one converged MATERIAL, which was folded, and R3 found 0 BLOCKING/MATERIAL. The R3 LOW pass is committed. Next come self-review, the pre-push suite, the push and the PR.** `main` is at `71c6cac` plus this handoff, and no PRs are open. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided: nothing this session.
- Claude decided under Alex's delegation (2026-09-28):
  - Graded R2's converged `PERSONA-REPLAY-HARNESS.md:36` finding MATERIAL (DA called it LOW, the surrogate MATERIAL), per the convergence rule. That opened R3.
  - Kept surrogate R2 3 and 4 (`record-persona-replay.ts`'s stale "three cascade functions" count and its "future 5.3 sub-chunk" forward reference) out of A4 as NOTICED items, following R1's precedent. Both are true at source but aren't latency cites.
  - Folded R3's converged L1 (the ADR's neighbouring decisions left stale) in the LOW pass rather than deferring it. DA pointed out that a bare "scope creep" deferral is `RATIONALIZATIONS.md:82`, and the fix was one paragraph in a section the PR already writes.

**Done this session:**

- **Merged `origin/main`** into the branch (`18665ef`; #119 and the Session 68 handoff).
- **Pre-push suite at `18665ef`:** build, lint, typecheck, format:check and knip passed. Every test passed except `@moe/core`'s 20 DB-backed files (`DATABASE_URL is not set`, plus the pool `TypeError`s that follow from it, checked by error class). The test step ran on its own (PPPPP).
- **R2** (range `4217a18..48efbc0`, both isolated): DA 0 BLOCKING / 0 MATERIAL / 2 LOW (+1 Nit); surrogate 0 / 1 / 3 (+2 FYI). Reports: `.claude/research/workflow-series/a4-cites-r2/`.
  - Both confirmed F1–F6 as applied and true at source.
  - **Converged:** decision 10 of `docs/decisions/PERSONA-REPLAY-HARNESS.md` still said 20s holds "for every production call site", which the pull loop falsified at 6.1c (#103). Verified at source.
  - DA L2: the fold's own "Two callers override it" was a new hardcoded count. Surrogate 2: F4's settled VISION text read as a claim about moe's live replies today.
- **R2 fold** (`implementer`, per `a4-cites-r2/fold-brief.md`, `6220a3f`): F1 appended a dated Status update to the ADR (decision 10 itself untouched, per `docs/decisions/README.md` §Lifecycle). F2 made the TSDoc count-free and gave "live-diagnosed" to both overrides. F3 made VISION `:317` a counterfactual. The orchestrator read the word diff, and it matches the brief. The worker ran prettier, eslint and the `@moe/agents` tests (323 passing), and used its own Sonnet trailer.
- **R3** (range `18665ef..6220a3f`): DA 0 / 0 / 1 (+1 Nit, 2 FYI); surrogate 0 / 0 / 1 (+2 FYI). Reports: `a4-cites-r3/`. Both converged on the one LOW: the new Status update footnoted decision 10 but left decisions 4 and 5 and the Deferred list stale (`DA-REVIEW.md` §Multi-section).
- **R3 LOW pass** (orchestrator, `f057ef1`, recorded in `a4-cites-r3/low-pass.md`): a second Status-update paragraph (five call sites and Result shapes; all 8 personas now have prompts and scenarios, both verified at source), and "the 20s per-attempt limit" (DA N1). **Orchestrator-applied, no further round; disclose in the PR.**
- **Memory:** `independent-review-angle-convergence.md` gained this PR's R2/R3 instance.

**In flight:** nothing running.

**Next, and open questions for Alex:**

- **[ALEX]** Confirm the order of the post-A4 workstreams: the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream (candidates in `git show 3abde05:PROGRESS.md`'s Session 52 entry). It has been carried since at least the Session 64 entry.

**Cleanup:** all four R2/R3 review worktrees and their `worktree-agent-*` branches were removed, after checking the report copies byte for byte. `git worktree list` shows only the primary checkout. `fix/vision-latency-cites` is kept (unpushed work). Session 64 was archived into `docs/history/SESSIONS.md`, because this entry made 6.

**Session data:** ~150k tokens at handoff (usage tool; 5-hour window 15%, weekly 53%, Fable weekly 4%). Context at load: 94.0k (usage tool), so row 1 fired at ~134k. Tool schemas at load: 49.9k (system tools 30.7k plus MCP tools 19.2k).

- **Trigger:** row 1, a phase boundary (the R3 LOW pass committed) at 141.8k. The R2 fold commit at 126.5k came before the threshold.
- **What grew context most:**
  - The ~94k loaded start, ~14k above Session 68's 80.5k. The whole of `origin/main`'s `PROGRESS.md` (37.9 KB, ~10k) was read, not just its loading-instructions block.
  - The four R2/R3 hand-backs (~8k).
  - Verifying the R2 and R3 findings at source (~6k).
  - The R2 fold brief and the LOW-pass note (~4k).
- **Subagent tokens:** DA R2 85k, surrogate R2 131k, R2 fold 25k, DA R3 81k, surrogate R3 94k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 69):**

- **SSSSS — RRRRR recurred one layer out: R1's sibling sweep stayed in code, and the false claim also lived in a decision record.** "Every production call site" survived in decision 10 of `PERSONA-REPLAY-HARNESS.md` until R2. The Status update written to fix it then left decisions 4 and 5 stale beside it (R3). When correcting a false claim, grep its key phrase across `docs/decisions/` too. When footnoting one decision, re-read its neighbours for the same drift. → none (a recurrence of RRRRR, plus `DA-REVIEW.md` §Multi-section's rule, already written).
- **TTTTT — OOOOO recurred: the R1 fold brief's own text produced two of R2's LOWs** (a new hardcoded "Two callers" count, and VISION text that read as a present-tense claim). A replacement sentence in a brief is new claim text, and it needs the same count-free, counterfactual-aware check as the findings it folds. → none (instance of `REVIEW-PATTERNS.md` §Over-correction's third failure mode).

### Session 70 loading instructions

- **Check live state first:**
  - `git fetch`, then read **`git show origin/main:PROGRESS.md`**. Read the newest entry and its loading-instructions block, not the whole file.
  - `git log --oneline -3 origin/main` (expect this handoff on top of `71c6cac`), `git status`, `gh pr list` (expect none open), and `git log --oneline main..fix/vision-latency-cites` (expect 5 commits, including the merge, ending `f057ef1`).
  - `fly status -a moe-<persona>` for all 8 persona Apps.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: finish `fix/vision-latency-cites` (A4).**
  1. Check out the branch, and merge `origin/main` (this handoff moved it).
  2. Self-review per `docs/SELF-REVIEW.md` over `main...HEAD`: 6 files (`docs/VISION.md`, `docs/decisions/PERSONA-REPLAY-HARNESS.md`, `create-anthropic-client.ts` and its test, `record-persona-replay.ts`, `create-pull-loop-behavior-deps.ts`).
  3. Run the pre-push suite: `pnpm build`, then the test step on its own (WWWW, PPPPP), then lint, typecheck, format:check and knip. The script suite doesn't apply.
  4. Push, and open the PR: `🐛 fix(docs): drop the phantom VISION §6.4 latency-target cites`, labels `fix`, `agents`, `server` (derive them again from `git diff --stat origin/main..HEAD` after the merge, per JJJJJ).
     - Body: the "Dismissed / PR body" items from `a4-cites-r1/fold-brief.md` and `a4-cites-r2/fold-brief.md`, plus `a4-cites-r3/low-pass.md`'s. Disclose that the R3 LOW pass (`f057ef1`) was orchestrator-applied with no further round, and that the orchestrator verified its facts at source.
     - Post the surrogate R1–R3 reports as one comment.
     - HHHHH: the push and `gh pr create` may need Alex's word in chat. Batch them.
     - `docs/VISION.md` is blast-radius, so Alex merges.
- **Decision branches:**
  1. If self-review finds a BLOCKING or MATERIAL, fold it and run a range check before pushing.
  2. **[ALEX]** The post-A4 order (see "Next" above). Ask in chat once the PR is open.
- **Carry-overs:**
  - WWWW and PPPPP go into `docs/DEVELOPMENT.md` §Quick Reference, in the next PR that touches it.
  - IIIII rides in the next PR that touches `REVIEW-PATTERNS.md`.
  - After A4: the O10 Prettier chore PR, the Hook PR, and the chief-clancy doc-port workstream. Candidates are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - NOTICED items for a later cleanup PR:
    - #118's (its body).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor, which points to a bold lead-in, not a heading (surrogate R1 FYI 12 in `handoff-r1/`).
    - A4's out-of-scope findings: the "Dismissed / PR body" lists in `a4-cites-r1/fold-brief.md`, `a4-cites-r2/fold-brief.md` and `a4-cites-r3/low-pass.md`. The replay-harness count drift (`record-persona-replay.ts:43-44, :120-121, :145`, `replay-fixture.ts:5-10`) is one root and can be one commit.
  - The §9 review is due at Session 70 (`docs/SESSION-HANDOFF.md` §9). Session 70 is the next session, so run it after the A4 PR opens, or record why it waits.
  - Memory: `harness-and-tooling-gotchas.md` is past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 70:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 68

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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
