# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.md` for the mechanics).

## Next workstreams (after Session 72)

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

## Earlier: Session 70

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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
