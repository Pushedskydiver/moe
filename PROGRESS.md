# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.md` for the mechanics).

## Next workstreams (after Session 74)

Updated 2026-09-28 end-Session-74 — **#121's hook is verified live. The §9 PR's R2 found one converged MATERIAL, and it is folded on the local branch `docs/s9-review-harvests` (`d964d05`, not pushed, no PR). R3 is next.** `main` is at `b70a3cb` plus this handoff, and no PRs are open. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided: nothing new this session. His Session 73 answers on #121 still stand (the Session 73 entry, "Alex decided").
- Claude decided under Alex's delegation (2026-09-28):
  - Graded the R2 convergence at the higher severity: `DA-REVIEW.md:119` and `da-review.md:25` still told reviewers to return findings as the tool result, against step 5's new report-file rule (surrogate M1, DA L3). Two LOW pairs converged as well: the `env -u` reason dropping `implementer.md`'s host guard (DA L1, surrogate L2), and `TESTING.md:13` (DA L2, surrogate leftover a).
  - Folded all of R2's LOWs and Nits with the MATERIAL, so R3 checks one range. The fixer's two leftovers got these grades:
    - (a) "all packages" / "Run all tests" isn't false, per both reviewers. Only `TESTING.md:13` changed.
    - (b) The surrogate's `description` "in-band" is a LOW, folded under G1.
  - Archived Session 70 at handoff rather than at load. At load the band was 40.3 KB (≈10.1k tokens), right at §10's line. Session 73 did the same.

**Done this session:**

- **#121's hook, verified live:** in this session, started on `main` after the merge, `echo "fly deploy"` raised Alex's confirmation prompt, and the command ran only after he confirmed. That was under `defaultMode: "auto"`, so auto mode doesn't bypass a hook's `ask`. Piped JSON gave the same `ask` from the script on its own. EEEEEE is confirmed and filed to memory (`harness-and-tooling-gotchas.md`).
- **R2** (range `ba9c0b2..ff6bc74`, DA and surrogate in parallel, worktree-isolated): DA 0/0/4 (+6 Nit, 2 FYI), surrogate 0/1/2 (+4 FYI). Both confirm F1–F17 are folded. Reports: `s9-pr/r2/da.md` and `surrogate.md`, both written to file through Bash (the hand-backs were ~0.5k each).
- **R2 fold** (`doc-fixer`, brief `s9-pr/r2/fold-brief.md`, items G1–G5 and N3–N6): `f04cfb6` (agents, `DA-REVIEW.md`), `1a02893` (`DEVELOPMENT.md`, `TESTING.md`) and `d964d05` (`SESSION-HANDOFF.md`). Report: `s9-pr/r2/fold-report.md`. `check:agents`, `typecheck:scripts`, `test:scripts` (103) and `check:rulebook` pass, and Prettier is clean.
  - Not verified yet: the fold itself. That is R3's job.

**In flight:** nothing. No agents are running.

**Next, and open questions for Alex:**

- **§9 PR:** R3, then the LOW pass, self-review, the pre-push suite, push, and PR. Alex merges.
- **The hook follow-up PR**, carrying Alex's three Session 73 answers (its own branch, after the §9 PR).
- **[ALEX]** Nothing pending. If R4 is reached, ask.

**Cleanup:**

- Both R2 review worktrees were auto-removed, and `git worktree list` shows only the primary checkout.
- `docs/s9-review-harvests` is kept (in progress).
- The scratchpad was cleared.
- Session 70 was archived into `docs/history/SESSIONS.md`. Its lessons were harvested as follows:
  - UUUUU by the §9 PR (§5 step 1).
  - VVVVV → none.
  - WWWWW to memory.

**Session data:** 129.2k tokens at the row-1 check (usage tool; 5-hour window 57%, weekly 58%, Fable weekly 9%). Context at load: 80.6k (usage tool), so row 1's line was ~120.6k. Tool schemas at load: 50.0k (system tools 30.7k plus MCP tools 19.2k).

- **Trigger:** row 1. The R2 fold committed (a phase boundary) at 129.2k, 48.6k above load.
- **What grew context most:**
  - `docs/SESSION-HANDOFF.md` (~6k).
  - `DEVELOPMENT.md`'s Round-2 section (~4k).
  - The R2 reports' LOW and Nit sections, read to write the fold brief (~5k).
  - The primary-source check of the MATERIAL (~2k).
- **Subagent tokens:** DA R2 111.3k, surrogate R2 145.3k, fold fixer 64.1k (320.7k in all).
- **Structural warning signs:** none.
- **Clarifying question needed, or a fact in the last entry wrong or missing at load:** none.

**Lessons (Session 74):**

- **FFFFFF — A new rule's contradicting siblings don't turn up in a sibling sweep for old wording.** R1's F2 added the report-file rule to `DEVELOPMENT.md` and `copilot-surrogate.md`. `DA-REVIEW.md:119` and `da-review.md:25` still said the opposite ("return findings as the tool result"), and it took both R2 reviewers to find them. Standing line 1 greps for a _corrected_ claim's old wording, but a new rule has no old wording. Its conflicts are found by grepping for the opposite instruction. → `docs/DEVELOPMENT.md` standing line 1, in the next PR that touches it: "for a new rule, grep for the instruction it contradicts".
- **GGGGGG — DDDDDD recurred: this session's fold brief inverted its source.** G2 said "the unset is a backstop", but `implementer.md:35` says the host _guard_ is. The fixer caught it by reading the source, as the brief told it to. This is the second instance (DDDDDD was the first), so DDDDDD's own rule applies. → `docs/DEVELOPMENT.md`: widen standing line 2 from "every fold brief" to every brief, in the next PR that touches it (the §9 PR's LOW pass may carry it if R3 is clean).

### Session 75 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`.
  - `git log --oneline -3 origin/main` (expect this handoff on top of `b70a3cb`), `git status`, `gh pr list` (expect none), and `git log --oneline origin/main..docs/s9-review-harvests` (expect 13 commits, top `d964d05`).
  - `fly status -a moe-<persona>` for each `fly.*.toml`.
  - Record the `get_usage` context figure right after loading, and again before every dispatch. Row 1 fires at that figure + 40k. Run §10's archival check.
- **The §9 PR's R3** on `docs/s9-review-harvests`, per `docs/DEVELOPMENT.md` §Review Gate:
  - Range `ff6bc74..d964d05`. Dispatch DA and the surrogate (the MATERIAL converged across both), in parallel and worktree-isolated. List R2's items from `s9-pr/r2/fold-brief.md` (G1–G5, N3–N6), and have the reports written to `s9-pr/r3/` through Bash at absolute paths.
  - Ask R3 to check G2's wording against `implementer.md:35` and `test-db.ts` (the brief itself inverted it; see GGGGGG).
  - If R3 is clean, run the LOW pass. It can carry FFFFFF's and GGGGGG's standing-line edits, since the PR already touches `DEVELOPMENT.md` §Review Gate. Then self-review over `main...HEAD`.
  - Then the pre-push suite, each step on its own, with tests as `env -u DATABASE_URL pnpm -r --no-bail --if-present run test`, plus the four script-suite commands.
  - Then push, open the PR (`📝 docs(handoff): …`, label per `docs/GIT.md`), and post the surrogate's R1, R2 and R3 reports as one comment. Alex merges.
- **Then the hook follow-up PR** (its own branch). Scope: Alex's three answers in the Session 73 entry's "Asked and decided", plus #121's body ("Questions for Alex"). It touches `scripts/guard-fly.ts` and its tests, `docs/GIT.md`'s blast-radius list, and `AGENTS.md`'s deploy wording (plus any sibling copy, e.g. `docs/OPERATIONS.md` and `docs/GIT.md` §Deploy Flow). Full gate; the surrogate is mandatory. Per `DEVELOPMENT.md` step 4, the changed hook gets a headless `claude -p` check before merge and a fresh-session desktop check after it.
- **Decision branches:**
  1. If the §9 PR's R4 still finds BLOCKING/MATERIAL, ask Alex.
  2. **[ALEX]** Merging the §9 PR and the hook follow-up PR.
- **Carry-overs:**
  - After the hook follow-up: the O10 Prettier chore PR (scope: `git show 3abde05:PROGRESS.md`, "[ALEX] O10"). Then the chief-clancy doc-port: its scope is `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md` plus Alex's Session 70 decision (`git show 8680b6a:PROGRESS.md`), and its mechanics are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - NOTICED items for a later cleanup PR:
    - #118's, #120's and #121's (their bodies).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`).
    - The replay-harness count drift, including `REVIEW-PATTERNS.md:19`'s scenario counts (§9 PR surrogate R1 L9 in `s9-pr/r1/`).
    - `DEVELOPMENT.md:11`'s `engines` "pins" (the same report's FYI4).
- **Recommended model and effort for Session 75:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 73

Updated 2026-09-28 end-Session-73 — **#121 is merged (`0a7061f`). The §9 review PR is built and R1-folded on the local branch `docs/s9-review-harvests` (`ff6bc74`, not pushed, no PR). R1 found 2 converged MATERIALs plus 2 more; all were folded. R2 is next.** `main` is at `0a7061f` plus this handoff. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided (2026-09-28):
  - Merged #121.
  - #121's three questions, all taking the recommended or first option:
    1. The deploy-equivalent commands ask too: `fly machine update --image`, `fly image update`, `fly scale count`, `fly machine clone` and `fly apps destroy`.
    2. `.claude/settings.json` joins `docs/GIT.md`'s blast-radius list.
    3. An agent may run a deploy (`fly deploy` or mutating `fly secrets`) when Alex explicitly asks for it in chat, after the hook's prompt. `AGENTS.md`'s "A human runs the deploy command" gets reworded; agents never deploy on their own initiative.
- Claude decided under Alex's delegation (2026-09-28):
  - Graded both reviewers' R1 convergences at the higher severity: report-to-file vs the reviewers' missing Write tool (DA M2, surrogate M2), and the plain `&&` chain vs the new step 4 (DA M1, surrogate L8).
  - Widened the fold to `AGENTS.md` (a comment under the pre-push chain, and "newest entry" at lines 7 and 110) and to `copilot-surrogate.md` step 6. Both are sibling copies of claims this PR changes, so they fall under the PR's own new standing sweep line.
  - Deferred surrogate L9 (stale replay-scenario counts in `REVIEW-PATTERNS.md:19`) to the NOTICED cleanup PR's replay-harness count-drift commit, which has the same root. Also deferred surrogate FYI4 (`engines` is a range, not a pin).
  - Split `harness-and-tooling-gotchas.md` (9.7 KB) into itself (4.0 KB) and a new `agent-dispatch-gotchas.md` (2.9 KB). That closes the 10+-handoff carry-over (report rec 10).

**Done this session:**

- **#121:** CI was green (5/5). Alex merged it as `0a7061f`. The local branch is deleted, and the remote one deleted itself.
- **§9 report spot-check** (`s9-review-2/report.md`): the S61, S64 and S67 rows match their entries. The carry counts check out: WWWW is in the newest loading block of 11 handoffs (S59–S69) and IIIII in 6 (S64–S69).
- **§9 PR built** (`doc-fixer`, brief `s9-pr/brief.md`): `226ac44`, `cd22ca5` and `01de2c5`, plus `10f4a8b` (orchestrator: the tool-schema range widened to 49.4–50.3k, S66–S72). `origin/main` was merged in (`ba9c0b2`).
  - `SESSION-HANDOFF.md`: §5 step 1's newest-entry read (UUUUU, ZZZZZ), §8's end date, §9's fields and second-review record, §10's mechanical check, §11.
  - `DEVELOPMENT.md`: the local test step (WWWW, PPPPP), the hook live check (YYYYY), report files (AAAAAA), and two standing fold-brief lines (report rec 11).
  - `REVIEW-PATTERNS.md`: instance 6 (IIIII).
- **R1** (range `0a7061f...ba9c0b2`, DA and surrogate in parallel, worktree-isolated): DA 0/2/6 (+9 Nit, 4 FYI), surrogate 0/2/9 (+4 FYI). Reports: `s9-pr/r1/da.md` and `surrogate.md`. The surrogate had no Write tool, so its report was extracted verbatim from the transcript.
- **R1 fold** (`doc-fixer`, brief `s9-pr/r1/fold-brief.md`, items F1–F17): `018b55a`, `d79e0d4`, `74f126d`, `a786028` and `ff6bc74`. Report: `s9-pr/r1/fold-report.md`. `check:agents`, `typecheck:scripts`, `test:scripts` (103) and `check:rulebook` pass, and Prettier is clean.
  - Not verified yet: the fold itself. That is R2's job.
- **#121 live check, inconclusive:** `echo "fly deploy"` ran with no prompt in this session. The session started before the hook existed in the checkout, and hooks are most likely snapshotted at session start (unverified), so this isn't evidence either way.

**In flight:** nothing. No agents are running.

**Next, and open questions for Alex:**

- **§9 PR:** R2, then the LOW pass, self-review, the pre-push suite, push, and PR. `AGENTS.md` and all three docs are blast-radius, so Alex merges.
- **#121's hook, verified live** from a session started on `main` after the merge.
- **The hook follow-up PR**, carrying Alex's three answers above (its own branch, after the §9 PR).
- **[ALEX]** Nothing pending. If R4 is reached, ask.

**Cleanup:**

- `chore/fly-guard-hook` was deleted (merged).
- Both R1 review worktrees were auto-removed, and `git worktree list` shows only the primary checkout.
- `docs/s9-review-harvests` is kept (in progress).
- The scratchpad was cleared.
- Session 69 was archived into `docs/history/SESSIONS.md`. With this entry the band would have been ~12k tokens (38.8 KB at load plus this entry). Its lessons, SSSSS and TTTTT, are harvested by the §9 PR's standing fold-brief lines.

**Session data:** 177.1k tokens at handoff (usage tool; 5-hour window 36%, weekly 56%, Fable weekly 5%). Context at load: 79.4k (usage tool), so row 1's line was ~119.4k. Tool schemas at load: 50.9k (system tools 31.3k plus MCP tools 19.6k).

- **Trigger:** row 2. The fire-point figure is 167.4k, at the first `get_usage` check after load, taken right after dispatching the R1 fold. Row 1's line had already passed unchecked (see CCCCCC). The session finished the unit in progress (the R1 fold, committed) and handed off at 177.1k.
- **What grew context most:**
  - The surrogate's R1 hand-back came back whole (~6k), because it couldn't write a file.
  - The `DEVELOPMENT.md` and `REVIEW-PATTERNS.md` section reads, used to write the brief (~9k).
  - `docs/SESSION-HANDOFF.md` (~6k) and the §9 report (~4k).
  - The three hand-backs from the fixer and DA (~5k together).
- **Subagent tokens:** fixer 75.1k, DA R1 161.4k, surrogate R1 147.5k, fold fixer 93.4k (477.4k in all).
- **Structural warning signs:** none.
- **Clarifying question needed, or a fact in the last entry wrong or missing at load:** one. The entry's "verify it live in this **desktop** session on `main`" can't work in a session that started before the merge (EEEEEE).

**Lessons (Session 73):**

- **CCCCCC — No `get_usage` check ran between the load (79.4k) and 167.4k.** §2 says to check before each dispatch. Four dispatches went out unchecked, and row 1 (~119.4k) passed silently. The first check came 48k past the line. This instance was the orchestrator fanning out background agents, with notifications as the only clock. → none (an instance of §2's written rule). If it recurs, make "call `get_usage`" a standing first line of every dispatch step.
- **DDDDDD — A build brief is claim text too.** This session's own brief carried two errors that review caught:
  - It told reviewers to use the Write tool, which they don't have (the converged M2).
  - It added "or an explicit named slot" to Alex's no-veto decision, taking the report's rec 8 wording (surrogate M1).
    This is TTTTT's class one step earlier, in the build brief rather than the fold brief. → `docs/DEVELOPMENT.md` (the report-file mechanism is folded in this PR). If it recurs, widen standing line 2 from "every fold brief" to every brief.
- **EEEEEE — A hook merged mid-session most likely can't be live-checked in that same session.** The Session 72 entry asked for exactly that. → the Session 74 loading instructions (done below), and memory once it is verified.

### Session 74 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`.
  - `git log --oneline -3 origin/main` (expect this handoff on top of `0a7061f`), `git status`, `gh pr list` (expect none), and `git log --oneline origin/main..docs/s9-review-harvests` (expect 10 commits, top `ff6bc74`).
  - `fly status -a moe-<persona>` for each `fly.*.toml`.
  - Record the `get_usage` context figure right after loading, and again before every dispatch (CCCCCC). Row 1 fires at that figure + 40k. Run §10's archival check.
- **First, while still on `main`:** verify #121's hook live. This session started after the merge, so its hook snapshot should include the hook. Run the harmless `echo "fly deploy"`: it should raise a confirmation prompt (a false positive by design). Never run a real `fly deploy`. Record the result, and file EEEEEE to memory once confirmed. If no prompt appears, diagnose the cause before assuming one (auto mode, the snapshot, or the hook itself).
- **Then the §9 PR's R2** on `docs/s9-review-harvests`, per `docs/DEVELOPMENT.md` §Review Gate:
  - Range `ba9c0b2..ff6bc74`. Dispatch DA and the surrogate (both had MATERIALs), in parallel and worktree-isolated. List R1's findings from `s9-pr/r1/fold-brief.md` (F1–F17).
  - Reviewers write their reports through Bash to absolute paths under `s9-pr/r2/`. They have no Write tool, so if the guard refuses a heredoc, they write in parts.
  - Ask the R2 reviewers to check the fixer's two leftovers: `docs/TESTING.md:12` and `AGENTS.md:15` still call plain `pnpm test` "all packages" / "Run all tests"; and `copilot-surrogate.md`'s `description` still says "in-band".
  - Then the LOW pass, and self-review over `main...HEAD`.
  - Then the pre-push suite, each step on its own, with tests as `env -u DATABASE_URL pnpm -r --no-bail --if-present run test`, plus the four script-suite commands (`AGENTS.md` and `.claude/agents/` are touched).
  - Then push, open the PR (`📝 docs(handoff): …`, label per `docs/GIT.md`), and post the surrogate's R1 and R2 reports as one comment. Alex merges.
- **Then the hook follow-up PR** (its own branch). Scope: Alex's three answers under "Asked and decided" above, plus #121's body ("Questions for Alex"). It touches `scripts/guard-fly.ts` and its tests, `docs/GIT.md`'s blast-radius list, and `AGENTS.md`'s deploy wording (plus any sibling copy, e.g. `docs/OPERATIONS.md` and `docs/GIT.md` §Deploy Flow). Full gate; the surrogate is mandatory.
- **Decision branches:**
  1. If the §9 PR's R4 still finds BLOCKING/MATERIAL, ask Alex.
  2. **[ALEX]** Merging the §9 PR and the hook follow-up PR.
- **Carry-overs:**
  - After the hook follow-up: the O10 Prettier chore PR (scope: `git show 3abde05:PROGRESS.md`, "[ALEX] O10"). Then the chief-clancy doc-port: its scope is `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md` plus Alex's Session 70 decision (`git show 8680b6a:PROGRESS.md`), and its mechanics are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - NOTICED items for a later cleanup PR:
    - #118's, #120's and #121's (their bodies).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`).
    - The replay-harness count drift, including `REVIEW-PATTERNS.md:19`'s scenario counts (§9 PR surrogate R1 L9 in `s9-pr/r1/`).
    - `DEVELOPMENT.md:11`'s `engines` "pins" (the same report's FYI4).
- **Recommended model and effort for Session 74:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 72

Updated 2026-09-28 end-Session-72 — **The Hook PR cleared its review gate and is open as [PR #121](https://github.com/Pushedskydiver/moe/pull/121) (`chore/fly-guard-hook`, `b288f9b`), waiting on CI and Alex's merge. R2 found 0 BLOCKING/MATERIAL, and the final LOW pass is committed and disclosed.** `main` is at `4e9b34e` plus this handoff. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided: nothing this session.
- Claude decided under Alex's delegation (2026-09-28):
  - Graded R2's converged LOWs at the higher severity, per the convergence rule. DA N2 and surrogate F4 ("merely ends in fly") became LOW.
  - Applied the R2 LOW pass as orchestrator, as with A4's R3 pass. The record is in `hook-r2/low-pass.md`, and the PR discloses it.
  - Moved DA R2 L4 into the PR body as Alex's third question, not folded, because it is a policy call: may an agent run a deploy when Alex asks it to? The deploy reason's "confirm only if Alex asked" says yes; `AGENTS.md`'s "A human runs the deploy command" says no.
  - Declined DA N4 (third-person "Alex", which is house style) and surrogate FYI2 (the false-negative list doesn't claim to be complete).
  - Handed off at the PR opening, 39.4k above load, just under row 1's 40k. The next phase is the whole §9 PR, and writing this handoff crossed the line anyway.

**Done this session:**

- **Merged `origin/main`** into `chore/fly-guard-hook` (`74013b0`).
- **R2** (range `0f40015..a24882c`, DA and surrogate in parallel, worktree-isolated): DA 0 BLOCKING / 0 MATERIAL / 4 LOW (+4 Nit, 2 FYI), surrogate 0 / 0 / 6 (+2 FYI). Reports: `.claude/research/workflow-series/hook-r2/da.md` and `surrogate.md`.
  - Both confirmed every fold item as applied and true at source. That covers the `--stage` claim for all five `fly secrets` subcommands (flyctl v0.4.108 `--help`) and the new lookbehind: `./fly`, `/usr/local/bin/fly` and `~/.fly/bin/flyctl` still ask, and DA saw the `moe.fly` test fail with the old lookbehind put back.
  - Converged LOWs, all verified at source by the orchestrator: the `--build-only` reason ("Build but do not deploy"; `--push` is separate), the backslash false negative (it only slips through before an indented line; checked by piping JSON), and the `:19` test name ("global flags" for `-a`).
- **R2 LOW pass** (orchestrator, `b288f9b`): the changes are listed in `hook-r2/low-pass.md`. Afterwards `test:scripts` (103), prettier, eslint and `typecheck:scripts` all passed.
- **Self-review** over `main...HEAD` was clean. One NOTICED item: a stdin of `null` crashes the hook. That fails open, and the header covers it.
- **Pre-push suite at `74013b0`:** build, lint, typecheck, format:check, knip and the script suite (`typecheck:scripts`, `test:scripts`, `check:agents`, `check:rulebook`) all passed. Every test passed except `@moe/core`'s 20 DB-backed files: 24 `DATABASE_URL is not set` errors, plus 23 pool `TypeError`s that follow from them, grouped by error class. The test step ran on its own (PPPPP).
- **#121 opened**, labelled `chore` (root-only change).
  - The body carries the headless live-check evidence, three questions for Alex, the gate history with the LOW-pass disclosure, and a NOTICED list.
  - The surrogate's R1 and R2 reports are posted as one comment.
  - It is bound to the session's PR monitor. CI had not reported at handoff.

**In flight:** CI on #121.

**Next, and open questions for Alex:**

- **[ALEX]** Merge #121 (`AGENTS.md` is blast-radius).
- **[ALEX]** #121's three questions:
  1. Should the deploy-equivalent commands ask too?
  2. Should `.claude/settings.json` join `docs/GIT.md`'s blast-radius list?
  3. May an agent run a deploy when you ask it to?

**Cleanup:**

- Both R2 review worktrees and their `worktree-agent-*` branches were removed. The reports were already in `hook-r2/`, and the worktrees were clean.
- `git worktree list` shows only the primary checkout.
- `chore/fly-guard-hook` is kept (open PR).
- The scratchpad was cleared.
- Sessions 67 and 68 were archived into `docs/history/SESSIONS.md`: 67 because this entry made 6, and 68 because the band was still ~12k tokens after that. At load the band was 5 entries and ~11k tokens (44 KB / 4). That is past §10's "roughly 10k", so it should have been archived at load; see ZZZZZ.

**Session data:** ~140k tokens at handoff (usage tool; 5-hour window 25%, weekly 54%, Fable weekly 4%). Context at load: 97.8k (usage tool), so row 1 fired at ~137.8k. Tool schemas at load: 50.0k (system tools 30.7k plus MCP tools 19.2k).

- **Trigger:** row 1, a phase boundary (the PR opened) at 137.2k, 39.4k above load. The handoff itself crossed the line.
- **What grew context most:**
  - The ~98k loaded start. The whole of `PROGRESS.md` was read again (~12k), because the paste-in prompt's own command prints the whole file (ZZZZZ).
  - `docs/SESSION-HANDOFF.md` (~6k) and `docs/SELF-REVIEW.md` (~4k), both read in full.
  - The full diff walk for self-review (~4k).
  - The two R2 hand-backs were only ~3k together, because each reviewer wrote its report to a file and returned a summary (AAAAAA).
- **Subagent tokens:** DA R2 100k, surrogate R2 102k.
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 72):**

- **ZZZZZ — UUUUU's fix can't work while it lives only in the loading instructions.** The paste-in prompt's step 1 (`git show origin/main:PROGRESS.md`) runs before the loading instructions are read. So the awk command in those instructions arrives only after the whole file has already been printed and read (~12k, the third session running). The same ordering meant the archival check at load was skipped: the ~11k band was only noticed at handoff. Until §5 changes, the handoff prompt given to Alex uses the awk command. → `docs/SESSION-HANDOFF.md` §5, in the §9 PR (already scheduled as UUUUU; this raises its priority).
- **AAAAAA — Asking a reviewer to write its full report to a file and hand back only counts plus one line per finding cut R2's hand-backs to ~3k, against ~9k for R1's in Session 71.** The orchestrator then reads the report file only where a finding needs checking. → `docs/DEVELOPMENT.md` §Quick Reference, in the §9 PR.
- **BBBBBB — A worktree-isolated reviewer's command check refused heredocs containing `(?<!` or `claude -p`.** The surrogate had to write its report in parts, lightly reworded. → memory (`harness-and-tooling-gotchas.md`).

### Session 73 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`.
  - `git log --oneline -3 origin/main`, `git status`, and `gh pr list`. #121 is open unless Alex merged it. If he did, expect its squash on top of this handoff.
  - `fly status -a moe-<persona>` for each `fly.*.toml`.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k. Run §10's archival check now.
- **First, if #121 is still open:** read its CI via `mcp__ccd_pr__get_status`, and fix any failure on the branch. Record any answers Alex gives to the three questions. An answer that changes code or docs goes in a follow-up PR, unless he asks for it on #121.
- **Once #121 is merged:** verify it live in this **desktop** session on `main`. The harmless `echo "fly deploy"` should raise a confirmation prompt. Never run a real `fly deploy`. Then delete the local and remote `chore/fly-guard-hook`.
- **Then the §9 review PR, bundled with the overdue harvests** (its own branch). Scope: the Session 70 entry's loading instructions (`git show 8680b6a:PROGRESS.md`, "Then the §9 review PR"). Alex has answered both of its questions: no §1 change, and no veto on §8's end date.
  - Add ZZZZZ to the §5 edit: the paste-in prompt's step 1 becomes the awk read.
  - Add YYYYY and AAAAAA to its `DEVELOPMENT.md` §Quick Reference edit.
- **Decision branches:**
  1. **[ALEX]** #121's merge and its three questions.
  2. If the §9 PR's R4 still finds BLOCKING/MATERIAL, ask Alex.
- **Carry-overs:**
  - After the §9 PR: the O10 Prettier chore PR (scope: `git show 3abde05:PROGRESS.md`, "[ALEX] O10"). Then the chief-clancy doc-port: its scope is `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md` plus Alex's Session 70 decision (`git show 8680b6a:PROGRESS.md`), and its mechanics are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - WWWW, PPPPP, IIIII, UUUUU, YYYYY, ZZZZZ and AAAAAA: scheduled into the §9 PR.
  - NOTICED items for a later cleanup PR: #118's (its body); `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`); #120's "Noticed but not touching" list (its body); and #121's (its body).
  - Memory: `harness-and-tooling-gotchas.md` is ~9 KB, past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 73:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 71

Updated 2026-09-28 end-Session-71 — **The Hook PR (`chore/fly-guard-hook`, `a24882c`; not pushed, no PR yet) is R1-reviewed and R1-folded. R1 found one converged MATERIAL and one DA-only MATERIAL. The first is folded, and orchestrator evidence closed the second. An R2 range check on `0f40015..a24882c` is next.** `main` is at `8680b6a` plus this handoff, and no PRs are open. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided (2026-09-28):
  - §1 stays unchanged, confirming the §9 second review's recommendation.
  - No veto on §8's end date: once a lesson's entry archives, an unharvested lesson gets its own small PR. It lands in the §9 review PR.
- Claude decided under Alex's delegation (2026-09-28):
  - Graded R1's converged findings at the higher severity, per the convergence rule: the secrets reason, the unlisted false negatives, the header's "do not ask" claim and the `.gitignore` label all became LOW.
  - Folded R1's LOWs together with the MATERIAL in one commit, so R2 checks them too.
  - Closed DA M2 ("no in-session check that the hook fires") with evidence, not a file change (see Done).
  - Two items are deferred to the PR body as questions for Alex. They are not folded, because the first reopens brief decision 3, which kept the hook narrow on PCR's prompt-fatigue argument.
    - DA L2: commands that act like deploys (`fly machine update --image`, `fly image update`, `fly scale count`, `fly machine clone`, `fly apps destroy`), all of which classify `null`.
    - DA's Consider: adding `.claude/settings.json` to `docs/GIT.md`'s blast-radius list.
  - The archival check at load found 5 entries but ~10.8k tokens (43 KB / 4), which is borderline for §10's "roughly 10k". It was deferred to this handoff, where the new entry made 6 anyway.

**Done this session:**

- **Merged `origin/main`** into `chore/fly-guard-hook` (`0f40015`).
- **R1** over `main...chore/fly-guard-hook` (5 files, +278), with DA and the surrogate in parallel, both worktree-isolated. Reports: `.claude/research/workflow-series/hook-r1/da.md` and `surrogate.md`.
  - DA: 0 BLOCKING / 2 MATERIAL / 2 LOW (+5 Nit, 2 Consider/FYI).
  - Surrogate: 0 / 2 / 7 (+2 FYI).
  - **Converged MATERIAL:** `AGENTS.md:48` and `guard-fly.ts:11` called the confirming human "the deploy authorisation". That overstated the coverage (the hook fails open, the regex misses some forms, and Codex never runs `.claude/` hooks). It also contradicted "Alex-only" and "A human runs the deploy command". Verified at source.
  - **DA M2:** nobody had watched the hook fire in a real session. **Closed by the orchestrator:** a headless `claude -p` on this branch was asked to run `echo fly deploy`. The hook intercepted it with the deploy reason, and it was denied despite `--allowedTools Bash` (`permission_denials` in the JSON output). That verifies that the settings load, `${CLAUDE_PROJECT_DIR}` expands and `node` resolves (this session's Claude process has mise shims on PATH). **It was the terminal env, not the desktop app, so the post-merge desktop check still stands.**
  - Both reviewers confirmed the cases the handoff named: `env FOO=1 fly deploy`, newline-separated scripts, `sh -c 'fly deploy'`, `flyctl` and flags before the subcommand. They also confirmed `fly secrets deploy`/`sync` exist (flyctl v0.4.108, `--help` only). DA's mutation run found that the child-process tests do catch a broken `main()`.
- **R1 fold** (`implementer`, per `hook-r1/fold-brief.md`, `a24882c`):
  - The backstop wording in `AGENTS.md:48` and the header.
  - Both reason texts (`--build-only`; `--stage` for every secrets subcommand).
  - The accepted false negatives are now listed in the header.
  - The lookbehind is now `(?<![\w.-])` (the `moe.fly` test was watched failing first).
  - Two test renames, the `.gitignore` label, and the unused `export type` dropped.
  - Worker-reported: typecheck:scripts, test:scripts (103), lint, format:check, check:agents, check:rulebook and knip all pass. The orchestrator read the `AGENTS.md` and `.gitignore` hunks, and both match the brief. **R2 checks the rest.**

**In flight:** nothing running.

**Next, and open questions for Alex:** none open now. The two deferred items above go into the PR body for him.

**Cleanup:**

- Both R1 review worktrees were auto-removed (`git worktree list` shows only the primary checkout).
- `chore/fly-guard-hook` is kept (unpushed work).
- Session 66 was archived into `docs/history/SESSIONS.md`, because this entry made 6.
- The scratchpad holds only the headless run's JSON and this entry's draft.

**Session data:** ~130k tokens at handoff (usage tool; 5-hour window 21%, weekly 54%, Fable weekly 4%). Context at load: 82.8k (usage tool), so row 1 fired at ~122.8k. Tool schemas at load: 50.0k (system tools 30.7k plus MCP tools 19.2k).

- **Trigger:** row 1, a phase boundary (the R1 fold committed) at 126.3k.
- **What grew context most:**
  - The two R1 hand-backs (~9k together), injected in full as agent messages.
  - `docs/SESSION-HANDOFF.md` read in full (~6k), as step 2 asks.
  - The fold brief (~3k), and the guard script's header and settings (~2k).
- **Subagent tokens:** DA 132k, surrogate 90k, fold 34k, plus one headless haiku run.
- **§9 review:** the evidence is in `s9-review-2/report.md`. Alex answered both of its questions this session, and applying it is still pending (the §9 PR).
- **Structural warning signs:** none.
- **Clarifying question needed that the last entry should have answered:** none.

**Lessons (Session 71):**

- **XXXXX — A hand-back report isn't in the subagent transcript's text blocks.** It is the input of the `SubagentHandback` tool call. `jq` over `.message.content[] | select(.type=="text")` saved an empty file. This worked: `select(.type=="tool_use" and (.name|test("Handback"))) | .input | to_entries[] | select(.value|type=="string") | .value`. → memory (`harness-and-tooling-gotchas.md`).
- **YYYYY — A headless `claude -p` run on the branch is a cheap pre-merge live check of a project hook.** In `-p` mode, an `ask` becomes a recorded `permission_denials` entry, even over `--allowedTools`. It proves the settings load, the path expands and the interpreter resolves, which a piped-JSON smoke test can't. It closed a DA MATERIAL without waiting for the merge. → `docs/DEVELOPMENT.md` §Quick Reference, in the §9 PR (it is already editing that section).

### Session 72 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`.
  - `git log --oneline -3 origin/main` (expect this handoff on top of `8680b6a`), `git status`, `gh pr list` (expect none open), and `git log --oneline main..chore/fly-guard-hook` (expect `a24882c` on top of `0f40015` and `6ba7a15`).
  - `fly status -a moe-<persona>` for each `fly.*.toml`.
  - Record the `get_usage` context figure right after loading. Row 1 fires at that figure + 40k.
- **First: the Hook PR's R2** (`chore/fly-guard-hook`).
  1. Merge `origin/main` into the branch first if it has moved (this handoff moved it). The R2 range stays `0f40015..a24882c`.
  2. R2: DA and the surrogate, since both had MATERIALs, in parallel and worktree-isolated. Give both the primary checkout's absolute path, `hook-r1/fold-brief.md`, and R1's findings by number from `hook-r1/da.md` and `surrogate.md`. Ask each to confirm or disprove every fold, and to find what the fold introduced. The new header and `AGENTS.md` text make fresh claims about the regex's false negatives and flyctl's `--stage` behaviour, and those need checking at source.
  3. Stop at 0 BLOCKING/MATERIAL, run the LOW pass, and disclose it in the PR. If R4 still finds BLOCKING/MATERIAL, ask Alex.
  4. Self-review, then the pre-push suite (test step on its own), **plus** the script suite.
  5. Push and open the PR as `📦 chore(hooks): …`, with labels per `docs/GIT.md`. The body carries:
     - the headless live-check evidence (Done above);
     - the two deferred questions for Alex (Asked and decided above);
     - the surrogate's R1 and later reports as one comment.

     `AGENTS.md` is blast-radius, so Alex merges.

  6. After the merge, verify it live in a new **desktop** session on `main`: the harmless `echo "fly deploy"` should raise a prompt. Never run a real `fly deploy`.
- **Then the §9 review PR, bundled with the overdue harvests** (its own branch). Scope: the Session 70 entry's loading instructions (`git show 8680b6a:PROGRESS.md`, "Then the §9 review PR").
  - Alex has now answered both of its questions: no §1 change, and no veto on §8's end date.
  - Add YYYYY to its `DEVELOPMENT.md` §Quick Reference edit.
- **Decision branches:**
  1. If the Hook R2 loop reaches R4, ask Alex.
  2. **[ALEX]** The PR body's two deferred questions (the deploy-equivalent commands, and `.claude/settings.json` on the blast-radius list), answered at review or merge.
- **Carry-overs:**
  - After the Hook PR: the O10 Prettier chore PR (scope: `git show 3abde05:PROGRESS.md`, "[ALEX] O10"). Then the chief-clancy doc-port: its scope is `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md` plus Alex's Session 70 decision (`git show 8680b6a:PROGRESS.md`), and its mechanics are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - WWWW, PPPPP, IIIII, UUUUU and YYYYY: scheduled into the §9 PR.
  - NOTICED items for a later cleanup PR: #118's (its body); `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`); and #120's "Noticed but not touching" list (its body).
  - Memory: `harness-and-tooling-gotchas.md` is ~9 KB, past the ~5 KB re-consolidation mark.
- **Recommended model and effort for Session 72:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
