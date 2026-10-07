# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/SESSION-HANDOFF.local.md` §Archive rule for the mechanics).

## Next workstreams (after Session 77)

Updated 2026-10-03 end-Session-77 — **#122 is merged (`65e2def`). The hook follow-up PR is built on `chore/guard-fly-follow-up` (`68056f2`, `b4afd4f`; pushed, no PR yet). R1 (DA + surrogate) is next.** All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided (2026-10-03): merged #122.
- Claude decided under Alex's delegation (2026-10-03), in the hook follow-up brief (`.claude/research/workflow-series/hook-follow-up/brief.md`):
  - **Every `fly machine update` asks**, not only `--image`. Without `--image` it still rewrites a live Machine's config, the regex can't reliably see a flag anywhere in the command, and the hook's stated posture is that a false positive costs one prompt.
  - **The deprecated top-level `fly destroy` asks** (a `fly apps destroy` alias, per `fly destroy --help`). Its pattern (`${FLY}${GAP}destroy`) also catches `fly machine destroy` and `fly volumes destroy`, which delete live resources too. Kept, and the header says so.
  - **The production migration stays Alex's.** Alex's answer 3 covers only `fly deploy` and mutating `fly secrets`, so `docs/GIT.md` §Deploy Flow step 2 rewords only the `fly deploy` half.
  - **The generated `fly.*.toml` comment** changes from "Alex-only … CLAUDE.md" to "Alex's call … AGENTS.md". It's a sibling copy of the claim answer 3 makes false, and `CLAUDE.md` only imports `AGENTS.md`.

**Done this session:**

- **#122 merged** by Alex. Local `docs/s9-review-harvests` deleted; the remote deleted itself.
- **Hook follow-up built** by `implementer` (Sonnet) under the brief above, which settles Alex's three Session 73 answers (`git show b70a3cb:PROGRESS.md`):
  - `68056f2` 📦 `chore(hooks)`: `scripts/guard-fly.ts` gets two new kinds, `machines` (`fly machine update`/`clone`, `fly image update`, `fly scale count`, with the `machines`/`m`/`img` aliases) and `destroy` (`fly apps destroy` with `app` and `delete`/`remove`/`rm`, and `fly … destroy`). Check order: secrets, destroy, machines, deploy. The secrets reason now makes Alex's ask the condition. Each reason clause rests on flyctl v0.4.108's `--help`; the implementer dropped "restarts it" for `machine update` and "its Machines and secrets"/"can't be undone" for `apps destroy`, because the help doesn't say them.
  - `b4afd4f` 📝 `docs(deploy)`: `AGENTS.md` §Commands (the comment, "Alex runs the deploy command, or an agent runs it when he explicitly asks…", and the backstop paragraph naming the deploy-equivalents), `docs/OPERATIONS.md:36`, `docs/GIT.md` §Deploy Flow step 2 and §Blast-Radius Docs (`.claude/settings.json` added), and `fly-app-config.ts:117` plus the eight regenerated `fly.*.toml` (one line each).
  - 14 files, +141/−30.
- **Verified by the orchestrator:** the two commits and the diff stat; `pnpm test:scripts` (141 pass); smoke runs through `node scripts/guard-fly.ts`: `fly m update 123` and `fly apps rm moe-sarah` ask, `fly machine list` prints nothing, `fly secrets deploy -a x` asks.
- **Verified only by the implementer's report, not re-run:** build, lint, typecheck, format:check, knip, `check:agents`, `typecheck:scripts`, `check:rulebook` (all exit 0); tests pass except `@moe/core`'s 20 DB-backed files ("not set" ×24, teardown TypeErrors ×23), as on every recent PR. It skipped watching the three `evaluateCommand` reason tests fail (written in the same step as the reason text).

**In flight:** nothing. No agents are running.

**Next, and open questions for Alex:**

- **The hook follow-up PR's review gate**, then open it (Session 78).
- **[ALEX]** Merge it once open (`AGENTS.md` and `docs/GIT.md` are blast-radius).

**Cleanup:**

- `docs/s9-review-harvests` deleted (merged as #122).
- `chore/guard-fly-follow-up` is kept (in progress, pushed).
- `git worktree list` shows only the primary checkout.
- The scratchpad was cleared.
- Session 73 was archived into `docs/history/SESSIONS.md`. Its lessons were already harvested: CCCCCC → none, DDDDDD → `docs/DEVELOPMENT.md`'s standing line 2 (merged in #122).

**Session data:** ~135k tokens at handoff (usage tool read 127.1k before the handoff writing; 5-hour window 81%, weekly 11%, Fable weekly 8%). Context at load: 81.4k (usage tool), so row 1's line was ~121.4k.

- **Trigger:** row 1. The build was committed (a phase boundary) at 127.1k, 45.7k above load. The 5-hour window (81%, resets 02:50Z) also argued against starting the two-reviewer R1 here.
- **What grew context most:**
  - `docs/SESSION-HANDOFF.md` (~6k) and the newest `PROGRESS.md` entry (~6k).
  - `scripts/guard-fly.ts` and its test (~4k).
  - `implementer.md` (~3k) and #121's brief (~2k).
  - The deploy-wording greps and reads across `AGENTS.md`, `docs/GIT.md` and `docs/OPERATIONS.md` (~5k).
  - Writing the brief (~4k).
- **Subagent tokens:** `implementer` 62.3k.
- **Structural warning signs:** none. One wasted call: a zsh loop passed `"machine update"` as one argument (it needed `${=c}`).
- **Clarifying question needed, or a fact in the last entry wrong or missing at load:** none.

**Lessons (Session 77):**

- **KKKKKK — When a brief widens a pattern on purpose, check the widened forms' own aliases too.** The brief verified `fly apps destroy`'s aliases (`delete`, `remove`, `rm`) but widened the destroy pattern to `fly machine destroy` and `fly volumes destroy` without checking theirs. The implementer found `fly machine rm`/`remove` and `fly volumes rm`/`delete` don't ask. It's an instance of `docs/DEVELOPMENT.md`'s standing line 2 (every brief is claim text), already codified. → none.

### Session 78 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`.
  - `git log --oneline -3 origin/main` (expect this handoff on top of `65e2def`), `git status`, `git log --oneline main..origin/chore/guard-fly-follow-up` (expect `b4afd4f` and `68056f2`), and `gh pr list` (expect none open).
  - `fly status -a moe-<persona>` for each `fly.*.toml`.
  - Record the `get_usage` context figure right after loading, and again before every dispatch. Row 1 fires at that figure + 40k. Run §10's archival check.
- **First, settle the `rm` gap before R1** (decision branch 1), so R1 reviews the final pattern.
- **Then the hook follow-up's review gate** (`docs/DEVELOPMENT.md` §Review Gate), on `chore/guard-fly-follow-up`:
  - R1: `da-review` and `copilot-surrogate` over `main...chore/guard-fly-follow-up`, in parallel. The surrogate is mandatory: `AGENTS.md` and `docs/GIT.md` are blast-radius. Both get the brief path (`.claude/research/workflow-series/hook-follow-up/brief.md`) and Alex's three answers (`git show b70a3cb:PROGRESS.md`, "Asked and decided"). Reports go to `.claude/research/workflow-series/hook-follow-up/r1/`.
  - Fold, range checks and the LOW pass per §Round-2 verification.
  - Per `DEVELOPMENT.md` step 4 (the hook bullet): a headless `claude -p` check of the changed hook before merge (e.g. a prompt that runs `fly scale count 2 -a moe-sarah` → expect a `permission_denials` entry), and a fresh-session desktop check after merge.
  - Then self-review (`docs/SELF-REVIEW.md`), the pre-push suite, and the PR. Title per `docs/GIT.md`, e.g. `📦 chore(hooks): ask before fly deploy-equivalents, and let an agent deploy at Alex's ask`. The body lists the four "Claude decided" calls above, the implementer's dropped `--help` clauses, and the skipped watch-fail for the reason tests.
- **Decision branches:**
  1. **The `rm` gap (Claude's call under delegation):** `fly machine rm`/`remove` and `fly volumes rm`/`delete` don't ask, while `fly machine destroy` and `fly volumes destroy` do. Recommended: extend the destroy kind to those aliases (same rationale as the `destroy` breadth, verified against `fly machine destroy --help` and `fly volumes destroy --help`), with tests, via a short `implementer` brief. The alternative is listing them as false negatives in the header.
  2. **[ALEX]** Merging the hook follow-up PR.
- **Carry-overs:**
  - After the hook follow-up: the O10 Prettier chore PR (scope: `git show 3abde05:PROGRESS.md`, "[ALEX] O10"). Then the chief-clancy doc-port: its scope is `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md` plus Alex's Session 70 decision (`git show 8680b6a:PROGRESS.md`), and its mechanics are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - NOTICED items for a later cleanup PR:
    - #118's, #120's and #121's (their bodies).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`).
    - The replay-harness count drift, including `REVIEW-PATTERNS.md:19`'s scenario counts (§9 PR surrogate R1 L9 in `s9-pr/r1/`).
    - `DEVELOPMENT.md:11`'s `engines` "pins" (the same report's FYI4).
    - #122's deferred surrogate R3 items 5, 7 and 8 (#122's body, and `s9-pr/r3/surrogate.md`). Item 5 (`TESTING.md`'s `--coverage` with no coverage package) needs a choice: install one or drop the line.
    - `fly machine kill` isn't covered by the hook (outside Alex's list; the implementer's report).
  - Review reports and briefs live in `.claude/research/workflow-series/` (gitignored).
- **Recommended model and effort for Session 78:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 76

Updated 2026-09-29 end-Session-76 — **The §9 PR is open as [PR #122](https://github.com/Pushedskydiver/moe/pull/122) (`docs/s9-review-harvests`, merge `3862711` on top of `141451c`), waiting on CI and Alex's merge.** Self-review found nothing, the pre-push suite passed, and the surrogate's R1–R3 reports are posted as one comment. `main` is at `4129625` plus this handoff. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided: nothing this session.
- Claude decided under Alex's delegation (2026-09-29):
  - Graded self-review as clean. `DEVELOPMENT.md`'s `DA-REVIEW.md:119` and `da-review.md:25` line references stay: they record what contradicted the new rule at R2, both files are in the same diff, and line 119 is still §Reporting channel's paragraph.
  - Archived Session 72 at handoff: with this entry, the band passes §10's token line. At load it was 37.6 KB (≈9.4k tokens) over 4 entries, under both lines.

**Done this session:**

- **Self-review** (`docs/SELF-REVIEW.md` over `main...HEAD`): no findings. Re-checked at source:
  - the review agents' tool lists;
  - `test-db.ts`'s host guard and its "DATABASE_URL is not set" error;
  - `ci.yml:41`'s `DATABASE_URL`;
  - `implementer.md:35`'s "Every test run";
  - fence balance;
  - §10's two commands, run as written.
  - `spec-grill.md` has no in-chat-only wording, so the report-file rule has no contradicting sibling there.
- **Pre-push suite** after merging `origin/main` (`3862711`): build, lint, typecheck, format:check, knip, `typecheck:scripts`, `test:scripts` (103), `check:agents` and `check:rulebook` pass. Tests: every package passes except `@moe/core`'s 20 DB-backed files. Every one of them imports the test DB helper, and their only errors are "not set" (24) and the TypeErrors that follow it (23).
- **#122 opened**, labelled `chore`. The body discloses that no fresh context checked the LOW pass (`1f4292f..141451c`) and lists surrogate R3 items 5, 7 and 8 as deferred. The surrogate's R1–R3 reports are posted as one comment (`## copilot-surrogate claim review — R1, R2 and R3`, 44.8 KB).
- **Pre-merge checkpoint**, walked against #122:
  1. Triggers fired: all 8 files are blast-radius, and the diff is 77 lines. There's no `fix(docs)` commit.
  2. Dispatched: R1 over the full diff, then R2 and R3 over the fold ranges to `d964d05`. The LOW pass is disclosed. The merge commit adds only `main`'s `PROGRESS.md` and `SESSIONS.md`.
  3. Posted: the comment title reads correctly.
  4. DA stayed in-chat: #122 has only the surrogate's comment.
- **Not verified yet:** CI on #122. It hadn't reported when the PR was bound (`mcp__ccd_pr__get_status`: 0 checks). `mergeStateStatus` is `BLOCKED`, as expected before CI and review.

**In flight:** CI on #122. No agents are running.

**Next, and open questions for Alex:**

- **[ALEX]** Merge #122 (all 8 files are blast-radius).
- **The hook follow-up PR** (its own branch), once #122 is merged or while it waits.

**Cleanup:**

- `git worktree list` shows only the primary checkout.
- `docs/s9-review-harvests` is kept (open PR).
- The scratchpad was cleared.
- Session 72 was archived into `docs/history/SESSIONS.md`. Its lessons were harvested as follows:
  - ZZZZZ and AAAAAA: in #122 (`SESSION-HANDOFF.md` §5, `DEVELOPMENT.md` §Quick Reference step 5).
  - BBBBBB → memory (`agent-dispatch-gotchas.md`).
- YYYYY (Session 71) now counts as harvested: it rides #122.

**Session data:** 131.2k tokens at the row-1 check (usage tool; 5-hour window 72%, weekly 60%, Fable weekly 10%). Context at load: 80.6k (usage tool), so row 1's line was ~120.6k.

- **Trigger:** row 1 at 131.2k, #122 opened.
- **What grew context most:**
  - The branch's word-diff (~12k).
  - `docs/SESSION-HANDOFF.md` (~6k).
  - `docs/SELF-REVIEW.md` (~4k).
  - Test output and the failure classification (~5k).
  - Reading #121's body and the Session 73/74 entries for the PR body's round counts (~5k).
- **Subagent tokens:** none. No agents were dispatched.
- **Structural warning signs:** none. One wasted tool call came from a zsh typo in a loop (not a forgotten session fact).
- **Clarifying question needed, or a fact in the last entry wrong or missing at load:** none. The R1 and R2 round counts for the PR body weren't in the newest entry, which cost reading two older entries (see JJJJJJ).

**Lessons (Session 76):**

- **JJJJJJ — When the next session will open a PR whose body needs the review record, the loading instructions should point at where each round's counts live.** The newest-entry read (§5) doesn't show older entries, so writing #122's Review gate section meant reading the Session 73 and 74 entries (~4k). Naming the commits (`b70a3cb`, `cd7d6e1`) in the loading block would have made it one targeted read. It's a one-off cost of the new read, so nothing changes. → none.

### Session 77 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`.
  - `git log --oneline -3 origin/main` (expect this handoff on top of `4129625`, or #122's squash on top if Alex merged it), `git status`, and `gh pr list` (expect #122 open unless merged).
  - `fly status -a moe-<persona>` for each `fly.*.toml`.
  - Record the `get_usage` context figure right after loading, and again before every dispatch. Row 1 fires at that figure + 40k. Run §10's archival check.
- **First, #122:**
  - If it's still open, read its CI via `mcp__ccd_pr__get_status` (bind it with `mcp__ccd_pr__bind_pr` if unbound), and fix any failure on the branch.
  - If it's merged, delete the local `docs/s9-review-harvests` (`docs/GIT.md` §Rules). The remote deletes itself.
- **Then the hook follow-up PR** (its own branch off `main`). Scope: Alex's three answers in the Session 73 entry's "Asked and decided" (`git show b70a3cb:PROGRESS.md`), plus #121's body ("Questions for Alex"). It touches `scripts/guard-fly.ts` and its tests, `docs/GIT.md`'s blast-radius list, and `AGENTS.md`'s deploy wording (plus any sibling copy, e.g. `docs/OPERATIONS.md` and `docs/GIT.md` §Deploy Flow). Full gate; the surrogate is mandatory. Per `DEVELOPMENT.md` step 4, the changed hook gets a headless `claude -p` check before merge and a fresh-session desktop check after it. If #122 isn't merged yet, the step 4 text is on #122's branch, so read it there (`git show origin/docs/s9-review-harvests:docs/DEVELOPMENT.md`).
- **Decision branches:**
  1. **[ALEX]** Merging #122 and the hook follow-up PR.
  2. If CI fails on #122 with a substantive fix (not formatting), treat the fix as a new round per §Round-2 verification.
- **Carry-overs:**
  - After the hook follow-up: the O10 Prettier chore PR (scope: `git show 3abde05:PROGRESS.md`, "[ALEX] O10"). Then the chief-clancy doc-port: its scope is `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md` plus Alex's Session 70 decision (`git show 8680b6a:PROGRESS.md`), and its mechanics are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - NOTICED items for a later cleanup PR:
    - #118's, #120's and #121's (their bodies).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`).
    - The replay-harness count drift, including `REVIEW-PATTERNS.md:19`'s scenario counts (§9 PR surrogate R1 L9 in `s9-pr/r1/`).
    - `DEVELOPMENT.md:11`'s `engines` "pins" (the same report's FYI4).
    - #122's deferred surrogate R3 items 5, 7 and 8 (#122's body, and `s9-pr/r3/surrogate.md`). Item 5 (`TESTING.md`'s `--coverage` with no coverage package) needs a choice: install one or drop the line.
  - Review reports and briefs live in `.claude/research/workflow-series/` (gitignored).
- **Recommended model and effort for Session 77:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 75

Updated 2026-09-29 end-Session-75 — **The §9 PR has cleared its review chain. R3 came back 0 BLOCKING/0 MATERIAL from both reviewers, and the final LOW pass is committed on the local branch `docs/s9-review-harvests` (`141451c`, not pushed, no PR). Self-review, the pre-push suite, push and PR are next.** `main` is at `cd7d6e1` plus this handoff, and no PRs are open. All 8 personas are `started` with checks passing.

**Asked and decided:**

- Alex decided: nothing this session.
- Claude decided under Alex's delegation (2026-09-29):
  - Graded R3's four convergences at the higher severity. They were all LOWs, so the chain stopped at R3: `DEVELOPMENT.md:48`'s "saves an empty file" (DA L1, surrogate 2), `TESTING.md:12`/`:14` unprefixed (DA L2, surrogate 4), the follow-on TypeErrors (DA Nit, surrogate 1), and the undefined `<session>` path (DA Nit, surrogate 3).
  - Folded every R3 LOW and Nit except surrogate 5, 7 and 8, plus FFFFFF's and GGGGGG's standing-line edits (brief H1–H10, `s9-pr/r3/fold-brief.md`). The three deferrals are older `TESTING.md`/`DA-REVIEW.md` claims this PR didn't introduce, so they go to the NOTICED cleanup PR (carry-overs). Surrogate 6, "Nothing uses it yet" about fast-check, was false and was deleted.
  - `SESSION-HANDOFF.md:146` now names Claude as the one who added §10's mechanical check (Session 73's §9 PR, `git show b70a3cb:PROGRESS.md` "Done this session"). No entry lists it as anyone's decision.
  - Archived Session 71 at handoff: with this entry, the band passes both §10 lines (5 entries, ~11k tokens). At load it was 38.1 KB (≈9.5k tokens) over 4 entries, under both lines.

**Done this session:**

- **R3** (range `ff6bc74..d964d05`, DA and surrogate in parallel, worktree-isolated): DA 0/0/3 (+4 Nit, 3 FYI), surrogate 0/0/10. Both confirm G1–G5 and N3–N6 are folded. They also confirm G2 went the right way round: the host guard is the backstop, as `implementer.md:35` says, not what the R2 brief said. DA ran G4's jq recipe against 124 real subagent transcripts, and it returned the report every time. Reports: `s9-pr/r3/da.md` and `surrogate.md`.
- **LOW pass** (`doc-fixer`, brief `s9-pr/r3/fold-brief.md`):
  - `1f4292f` and `7c87dbb` (`DEVELOPMENT.md`, the standing lines included), `db06acf` (`TESTING.md`), `ccc0742` (`SESSION-HANDOFF.md`) and `fca2be7` (`copilot-surrogate.md`). Report: `s9-pr/r3/fold-report.md`. `check:agents`, `typecheck:scripts`, `test:scripts` (103) and `check:rulebook` pass, and Prettier is clean.
  - I read the content diff (word-diff plus the three long `DEVELOPMENT.md` lines in full). It had one slip, in the fixer's extra sibling edit at `SESSION-HANDOFF.md:140`: "§5's step 1 `origin/main` read". I fixed it myself in `141451c` ("§5 step 1's"). Per §Round-2 verification, the PR must say that no fresh context checked the LOW pass.

**In flight:** nothing. No agents are running.

**Next, and open questions for Alex:**

- **§9 PR:** self-review (`docs/SELF-REVIEW.md` over `main...HEAD`), then the pre-push suite, push and PR. Alex merges.
- **The hook follow-up PR** (its own branch, after the §9 PR).
- **[ALEX]** Merging the §9 PR once it's open.

**Cleanup:**

- Both R3 review worktrees were auto-removed, and `git worktree list` shows only the primary checkout.
- `docs/s9-review-harvests` is kept (in progress).
- The scratchpad was cleared.
- Session 71 was archived into `docs/history/SESSIONS.md`. Its lessons were harvested as follows:
  - XXXXX → memory (`agent-dispatch-gotchas.md`); `DEVELOPMENT.md` step 5 now carries it too.
  - YYYYY on the §9 branch (`DEVELOPMENT.md` step 4's hook live check). It isn't in an open PR yet, so it's listed under carry-overs until the §9 PR opens.

**Session data:** 125.6k tokens at handoff (usage tool; 5-hour window 68%, weekly 60%, Fable weekly 9%). Context at load: 80.1k (usage tool), so row 1's line was ~120.1k. Tool schemas at load: 50.0k (system tools 30.7k plus MCP tools 19.2k).

- **Trigger:** row 1. The LOW pass committed (a phase boundary) at ~125k, 45.5k above load.
- **What grew context most:**
  - `docs/SESSION-HANDOFF.md` (~6k).
  - `DEVELOPMENT.md` §Review Gate (~5k).
  - The R2 fold brief and report (~3k).
  - The source checks behind the LOW brief (~4k).
- **Subagent tokens:** DA R3 129.7k, surrogate R3 173.1k, LOW fixer 52.3k (355.1k in all).
- **Structural warning signs:** none. One failed tool call came from zsh's `$c:P` modifier in a loop (a known gotcha, not a forgotten session fact).
- **Clarifying question needed, or a fact in the last entry wrong or missing at load:** none. The loading instructions didn't say where `s9-pr/` lives (`.claude/research/workflow-series/s9-pr/`), which cost one `find`.

**Lessons (Session 75):**

- **HHHHHH — A dispatch brief's "read the primary checkout at HEAD" is only true if that checkout is on the branch.** Both R3 briefs said the primary checkout had `docs/s9-review-harvests` checked out, but it was on `main` (handoffs leave it there). Only the brief's own fallback (`git show <sha>:<path>` if not) kept the reviewers off `main`'s copies. Check `git status -sb` of the primary checkout before writing a review brief, or check out the branch first. → memory (`agent-dispatch-gotchas.md`).
- **IIIIII — The LOW pass's own content-diff read earns its place.** The fixer made an edit the brief didn't ask for: a sibling sweep that added "§5's" to a second "step 1". It broke a possessive, and only the orchestrator's read of the word-diff caught it. The protocol already requires this read, so this lesson changes nothing. → none.

### Session 76 loading instructions

- **Check live state first:**
  - `git fetch`, then read the newest entry only: `git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1'`.
  - `git log --oneline -3 origin/main` (expect this handoff on top of `cd7d6e1`), `git status`, `gh pr list` (expect none), and `git log --oneline origin/main..docs/s9-review-harvests` (expect 19 commits, top `141451c`).
  - `fly status -a moe-<persona>` for each `fly.*.toml`.
  - Record the `get_usage` context figure right after loading, and again before every dispatch. Row 1 fires at that figure + 40k. Run §10's archival check.
  - Review reports and briefs live in `.claude/research/workflow-series/s9-pr/` (gitignored), under `r1/`, `r2/` and `r3/`.
- **The §9 PR** on `docs/s9-review-harvests`:
  1. Check out the branch, then walk `docs/SELF-REVIEW.md` against `git diff main...HEAD`. Fix anything found in its own commit.
  2. Merge `origin/main` in, since the branch is behind by the handoff commits.
  3. Run the pre-push suite one step at a time, with tests as `env -u DATABASE_URL pnpm -r --no-bail --if-present run test`, plus the four script-suite commands.
  4. Push and open the PR (`📝 docs(handoff): …`, labelled per `docs/GIT.md`). In the body, say that no fresh context checked the LOW pass (`1f4292f..141451c`), and list the three deferred surrogate R3 items.
  5. Post the surrogate's R1, R2 and R3 reports (`s9-pr/r{1,2,3}/surrogate.md`) as one comment. Then walk the pre-merge checkpoint (`DEVELOPMENT.md` §Review Gate) and hand the PR to Alex.
- **Then the hook follow-up PR** (its own branch). Scope: Alex's three answers in the Session 73 entry's "Asked and decided" (`git show b70a3cb:PROGRESS.md`), plus #121's body ("Questions for Alex"). It touches `scripts/guard-fly.ts` and its tests, `docs/GIT.md`'s blast-radius list, and `AGENTS.md`'s deploy wording (plus any sibling copy, e.g. `docs/OPERATIONS.md` and `docs/GIT.md` §Deploy Flow). Full gate; the surrogate is mandatory. Per `DEVELOPMENT.md` step 4, the changed hook gets a headless `claude -p` check before merge and a fresh-session desktop check after it.
- **Decision branches:**
  1. **[ALEX]** Merging the §9 PR and the hook follow-up PR.
  2. If self-review finds something substantive (not a LOW), fold it and treat the fold as a new round per §Round-2 verification rather than as part of the LOW pass.
- **Carry-overs:**
  - YYYYY (Session 71) is harvested on the §9 branch and counts once the §9 PR opens.
  - After the hook follow-up: the O10 Prettier chore PR (scope: `git show 3abde05:PROGRESS.md`, "[ALEX] O10"). Then the chief-clancy doc-port: its scope is `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md` plus Alex's Session 70 decision (`git show 8680b6a:PROGRESS.md`), and its mechanics are in `git show 3abde05:PROGRESS.md`'s Session 52 entry.
  - NOTICED items for a later cleanup PR:
    - #118's, #120's and #121's (their bodies).
    - `AGENTS.md:37`'s "§Node-native TS execution…" anchor (surrogate R1 FYI 12 in `handoff-r1/`).
    - The replay-harness count drift, including `REVIEW-PATTERNS.md:19`'s scenario counts (§9 PR surrogate R1 L9 in `s9-pr/r1/`).
    - `DEVELOPMENT.md:11`'s `engines` "pins" (the same report's FYI4).
    - §9 PR surrogate R3 items 5, 7 and 8 (`s9-pr/r3/surrogate.md`):
      - `TESTING.md:14`'s `--coverage` has no coverage package installed. That needs a choice: install one or drop the line.
      - `TESTING.md:5`'s "once Slack/GitHub integration code exists" is stale.
      - `TESTING.md:135`'s `SELF-REVIEW.md` forward reference, and `DA-REVIEW.md:221`'s "(once it exists)".
- **Recommended model and effort for Session 76:** Opus, `high`.
- **Fallback:** if Alex redirects on load, follow that.

## Earlier: Session 74

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

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

Moved to `docs/history/BUILD-NARRATIVE.md` (2026-09-27); `BUILD_PLAN.md`'s checkboxes remain the source of truth for what has shipped.
