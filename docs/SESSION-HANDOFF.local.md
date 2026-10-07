# Session handoff: moe's settings

The local half of `docs/SESSION-HANDOFF.md`, which is the AIOS hub core as a stamped copy (AIOS research/56 §6). The core calls this the local file. What is here applies to moe only. A change to the core goes to the AIOS hub's canonical, `hub/plugins/synced-docs/docs/SESSION-HANDOFF.md` in the AIOS repository, never into the copy, which changes only by a sync from the hub.

## Lines

The core's section 1, unchanged; moe overrides none of its lines. The core's trigger 1 now counts 40k from context at load, so moe needs no line of its own (AIOS research/72 §7, Q1, Alex, 2026-10-06).

Moe's own data, recorded per session since Session 46 in anticipation of the handoff doc: tokens at handoff were ~300k (Session 46), ~245k (Session 47), ~205k (Session 48), ~175k (Session 49), ~145k (Session 50), ~150k (Session 51), ~190k (Session 52), and ~150k (Session 53) — each session's own `PROGRESS.md` "Session data" line (Session 46: `git show 5f63516:PROGRESS.md`; Sessions 47–48: `git show 4b4536f:PROGRESS.md`; Sessions 49–53: `git show 76032c1:PROGRESS.md`). Session data and the ten-session review, below, is how this record stays honest rather than decaying into a felt sense of "about right."

Trigger 1 is relative to the context at load while triggers 2 and 3 stay absolute. That was Alex's call at the first ten-session review (2026-09-27, `git show 8e27f4c:PROGRESS.md`), made because the load then cost ~87–95k (Sessions 57–60), so a 100k line fired after about 10k of work. About 50k of the load is tool schemas, which moe doesn't control from the repo (first measured at Session 57; 49.4–50.3k across Sessions 66–72, Session data below). Separately, triggers 2 and 3 bound total input length, the quantity the core's evidence ties to degradation. The core has since adopted the same relative rule hub-wide.

The core's trigger 4 replaces moe's rule of 2026-09-27, which added no weekly-limit trigger row: either weekly figure at 85% or more puts any new multi-agent work to Alex before it starts (Alex, 2026-10-06; AIOS `PROGRESS.md`'s Session 42 entry, `c59cc58`, on AIOS research/65's question VF6). Moe keeps its own addition from that rule: every handoff notice names either weekly figure that is at 85% or more, whatever the five-hour window and whichever trigger fired. The 2026-09-27 rule said "the weekly %"; naming either figure is this file's reading of it.

## Deliverables

Moe's examples of what the core's trigger 1 calls a deliverable: PR opened, fold committed, PR merged, a chunk shipped, deploy verified. A PR merged is a boundary of its own in moe, beside the core's PR opened: Alex can merge while a session runs, and `docs/RATIONALIZATIONS.md`'s "one more chunk" row checks the trigger at each merge. In moe, the core's doc loop and its stop rule are `docs/DEVELOPMENT.md` §Review Gate's checks, which stop as its Round-2 verification paragraph says, and, for the specs and rationale docs that `spec-grill` grills, its §Two-phase grill discipline.

## Live checks

In each entry's loading instructions: `git fetch` first, then `git log origin/main`, `git status`, `gh pr list`, and `fly status -a moe-<persona>` for every persona App (one per `fly.*.toml`).

Moe's `<cwd-slug>` for the core's section 1 commands (observed): `/Users/alexclapperton/Desktop/alex/@moe` → `-Users-alexclapperton-Desktop-alex--moe`.

## Committing the entry

The `PROGRESS.md` entry is committed direct to `main` — no branch, no PR — even while another branch or PR is open, since it's session state, not architecturally reviewed content. This is `docs/GIT.md` §Rules' direct-to-main rule for docs only read for context, applied to this one file without its "only when no branch/PR is open" condition. Exception: if `PROGRESS.md` is already part of an open PR bundled with the work being logged, leave the update there instead of splitting it out.

## Cleanup

Moe's cleanup at handoff. The core's section 2 item 4 also applies, and some of these bullets repeat or widen it:

- Delete merged local branches (`docs/GIT.md` §Rules).
- Run `git worktree list` and remove finished, clean review worktrees under `.claude/worktrees/`.
- Clear this session's scratchpad if no agent still needs it.
- Withdraw stale suggestion chips (desktop only).
- Keep `.claude/research/workflow-series/` — gitignored and still referenced.
- Never clean while a background agent runs.
- Record what cleanup removed or skipped in a "Cleanup:" line in the entry (Entry shape below).
- Archival check (Archive rule below): primary at session start, secondary at handoff.

## Handoff prompt

Kept deliberately small, because the artefact carries the state:

```text
Continue the moe project.
1. Run git fetch, then read the newest entry of origin/main's PROGRESS.md (git show origin/main:PROGRESS.md | awk '/^## Earlier/{exit} 1') and follow its loading instructions.
2. Read docs/SESSION-HANDOFF.md and docs/SESSION-HANDOFF.local.md, and apply them to this session too.
3. Then carry on with the Next list. Ask me only what PROGRESS.md marks as mine to decide.
```

Step 1 reads `origin/main`'s copy because handoffs commit straight to `main` (Committing the entry), so a checkout left on a feature branch holds a stale entry. Every branch resume from Session 59 to 62 read the stale copy first, at a cost of ~9k per resume (Sessions 61–62). Under Committing the entry's exception, when the entry rides an open PR, `origin/main`'s copy is the stale one instead. The paste-in prompt's step 1 then names that PR's branch (`git show origin/<branch>:PROGRESS.md | awk '/^## Earlier/{exit} 1'`), since the notice goes only to Alex.

The `awk` stops at the first `## Earlier` heading, so only the newest entry is read. Reading the whole file cost ~10–12k per load (Sessions 65, 66, 69, 70 and 72 recorded it). The command has to live in the prompt itself, not only in the loading instructions, because step 1 runs before those instructions are read.

## Entry shape

Moe's settings within the core's section 4. `## Next workstreams (after Session N)` for the newest entry, then `## Earlier: Session N` for older ones; the handoff prompt's `awk` and the Archive rule's entry count depend on these headings. Each entry holds, in the core's order (Alex, 2026-10-06; AIOS `PROGRESS.md`'s Session 42 entry, `c59cc58`):

- "Updated `<date>` end-Session-N — **headline**."
- Asked and decided. Split what Alex decided from what Claude decided under his delegation, and tag each accordingly: only the first gets "(Alex, `<date>`)"; the second is tagged as Claude's call under Alex's delegation. Session 60's single "Asked and decided (Alex, …)" header filed Claude's delegated calls under Alex's name, and harvesting that entry into the handoff doc first tagged three of them as Alex's (Session 66, caught in review).
- Shipped/Done (paths; what was verified and how).
- In flight.
- Next, and open questions for Alex — anything marked his to decide.
- Cleanup (Cleanup above): moe's own field. It holds what the core's section 4 item 4 puts in In flight: what cleanup removed or skipped. A skip because a background agent is still running is also said in In flight, as the core's section 2 item 4 asks.
- `### Session N+1 loading instructions`.
- `### Lessons` (Lessons below).
- `### Session data` (Session data and the ten-session review below), the last field.

Lessons and Session data take `###` headings, not the bold labels older entries use: in the core's order they come after the loading instructions' heading, and a bold label there would read as part of that block.

Beyond what the core's section 4 item 6 lists (and the live checks above), the loading instructions carry:

- The primary workstream.
- Orchestration notes.
- Carry-overs. A deferred workstream keeps a pointer to where its scope is written (a commit's `PROGRESS.md`, or a brief file), never just a one-line label: five handoffs once carried "PR 5: docs thinning, plus VISION:327" while its real scope sat only in the Session 49 and 50 entries, which archived out of the detail band by the fifth.
- The fallback.

Anything that would touch a do-not-touch surface (`AGENTS.md` §Non-obvious constraints) is marked Alex's call.

## Model and effort for the next session

| Next session's main work                                                                                                      | Model           | Effort |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| Orchestrating a PR series: briefs, review dispatch, folds, protocol docs                                                      | Opus            | high   |
| Hard design judgement: ADRs, VISION positions, persona-prompt drafting with Alex, conflicting evidence                        | Fable           | high   |
| Live-fleet work: Alex-authorised deploys, `fly secrets`, the production DB, live Slack verification, multi-branch git surgery | Opus            | high   |
| Mechanical chores: archive commit, rename, lint fix                                                                           | Haiku or Sonnet | low    |

Moe's five agents in `.claude/agents/` keep their pinned tiers (the workers in `docs/DEVELOPMENT.md` §Session Pattern & Context Management, the review agents in its §Review Gate, and `spec-grill` in its §Two-phase grill discipline): they are what the core's section 1 calls a project's own pinned workers. Moe's sessions enable no hub worker plugin (its only hub plugin, `synced-docs`, has none). Say the effort explicitly — Opus 5.5 defaults to `medium` in Claude Code, one level below Opus 5's default of `high` — and prefer `high` for Opus unless there's a stated reason for less.

**This table is a snapshot, not a fixed ranking** — a new model release can shift where a row belongs, and the right response is a documented trial, not a silent edit. The Fable row is kept as a trial row: moe has never actually used Fable as a session model. The usage tool reports a separate "Weekly · Fable" window worth naming here — confirmed via `get_usage` on 2026-09-27 (Session 53), which listed "Weekly · Fable" at 4% used, separate from "Weekly · all models".

## New models

Moe sets no rule of its own for new models beyond the table's documented-trial note above. The core's section 1 applies: its model-and-effort command shows the model and effort a session actually ran.

## Flag fallback

Moe sets no fallback of its own: no `switchModelsOnFlag` is set in its `.claude/` settings. The core's section 1 applies: a second flagged message in a session is a structural warning sign under trigger 5, and after the first, trigger 5 says what to do. A switch is made visible by the core's model-and-effort command and recorded in Session data.

## Lessons

- Letters continue from the newest entry's last letter (for example, Session 53's last was `JJJJ`).
- Each lesson ends with a destination tag: `→ RATIONALIZATIONS.md §<phase>`, `→ REVIEW-PATTERNS.md §<area>`, `→ <other file>`, `→ memory`, or `→ none`.
- Both destination docs are blast-radius (`docs/GIT.md`'s list), so a harvest needs a PR. It rides in the next PR that already touches that doc. A harvest is due by the time its entry archives: it must be in an open or merged PR by then. Archival never waits on a merge; if a lesson is still unharvested, list it under the new entry's carry-overs.
- A harvest that reaches its entry's archival unharvested is not carried again as "rides the next PR". It gets its own small PR, recorded in the next loading instructions. Without an end, WWWW was carried in 11 handoffs and IIIII in 6 (the second review, under Session data and the ten-session review). (Alex, 2026-09-28: no veto.)
- Loading instructions stop carrying letter-range pointers such as "DDDD–EEEE above, BBBB–CCCC in the Session 50 entry…" — the letters live with the lessons themselves, not as a pointer chain.

## Session data and the ten-session review

Moe's Session data adds these to the core's section 4 item 8, whose fields also apply (the core adds the model and effort as run, and both weekly figures):

- Tokens at handoff to 0.1k, like context at load.
- With which trigger fired: the context figure when it fired (the fire-point figure), and the event (e.g. "trigger 1 at 141.8k, R3 LOW pass committed").
- With whether a clarifying question was needed that the last entry should have answered: whether a fact in the last entry was found wrong or missing at load.

There is no tool-schema field: tool schemas measured 49.4–50.3k across Sessions 66–72, close to constant, so re-measure them at each ten-session review or after a harness update instead.

Fields missing from older entries stay "not recorded", with no backfill. Sessions 46–52's gaps were a Claude call under Alex's delegation at the first review (Session 60). Claude extended the rule to context at load before Session 58, the first entry with a context-at-load field, when adding that field to the handoff doc (Session 66).

Review every ten sessions. Its result goes in `PROGRESS.md`: the entry of the session that runs it, and the entry where Alex answers its questions if that is a later one, as for both reviews below. A report behind it goes under the gitignored `.claude/research/`, as the second review's did (`.claude/research/workflow-series/s9-review-2/report.md`, `git show 8680b6a:PROGRESS.md`). In moe, that `PROGRESS.md` record stands for what the core's section 4 item 8 calls where the project keeps its research records. The first review ran at Session 60, over Sessions 46–59 (`git show 8e27f4c:PROGRESS.md`):

- Alex decided that trigger 1 becomes relative to the context at load (Lines above).
- He left the other items to Claude "as long as you have strong, real evidence". Under that delegation Claude adopted the context-at-load field, the handoff prompt's step 1 `origin/main` read and the no-backfill call.

The second review ran at Session 70, over Sessions 60–69 (`git show 8680b6a:PROGRESS.md`):

- Alex confirmed no trigger-threshold change and did not veto the Lessons end date (`git show 4e9b34e:PROGRESS.md`).
- Under his delegation Claude adopted the three Session data field changes, the no-tool-schema-field call and the handoff prompt's newest-entry read.
- The Archive rule's mechanical check came from Session 72's lesson ZZZZZ (the archival check was skipped because the handoff prompt's step 1 printed the file before the loading instructions were read), not from the review, which recommended no change to the Archive rule. Claude added the check to the handoff doc in Session 73's ten-session-review PR (#122) (`git show b70a3cb:PROGRESS.md`, "Done this session"), and no entry lists it as a decision by either Alex or Claude.

The next review is at Session 80.

## Archive rule

This rule stands in place of the core's section 5, as a local setting (Alex, 2026-10-06, AIOS research/72 §7, Q2), and keeps the check at the start of a session.

When the detail band (`## Next workstreams` down to `## Session archive` in `PROGRESS.md`) holds **more than 5 discrete session entries, or exceeds roughly 10k tokens** (whichever fires first), compress the oldest entry to a one-line row in `docs/history/SESSIONS.md` before continuing with the current session's own work. A token threshold over a fixed entry count, because session entries vary widely in size, so a fixed-N count drifts against the thing that actually matters — the band's size in tokens. That mattered most while the handoff prompt's step 1 read the whole file; it now bounds the cost of any full read of `PROGRESS.md`. The detail band is the only part of `PROGRESS.md` that grows and gets pruned; `## Session archive` and the `## Phase ledger` stub (pointing to the frozen ledger in `docs/history/BUILD-NARRATIVE.md`) are fixed sections below it.

**Check at session start, before picking up any workstream** — this is the primary trigger. A preemptive check at handoff time is a fine secondary habit but isn't a substitute for the session-start check; a check that only happens "when it occurs to someone" silently backslides. Step 1 of the handoff prompt reads only the newest entry, so it no longer shows the band. Check it mechanically instead (÷ 4 is a working estimate of tokens, not a measurement):

```bash
git show origin/main:PROGRESS.md | awk '/^## Next workstreams/{p=1} /^## Session archive/{exit} p' | wc -c   # bytes; ÷ 4 ≈ tokens
git show origin/main:PROGRESS.md | grep -c '^## \(Next workstreams\|Earlier: Session\)'   # entries
```

Under Committing the entry's exception (the entry rides an open PR), read `origin/<branch>` instead of `origin/main`, as the handoff prompt does.

`docs/history/SESSIONS.md` approximate shape:

```markdown
# Session archive

Historical one-line session headlines compressed from PROGRESS.md.
Full retrospective survives in `git log -p PROGRESS.md` at each
session's compression commit.

| Session | Date | Headline | PRs |
| ------- | ---- | -------- | --- |
```

One row per archived session. The **Headline** is one dense sentence — what made the session load-bearing, not a full recap (the full recap is `git log -p PROGRESS.md` at the compression commit). **PRs** links the session's PRs as `[#N](url)`, comma-separated when there are several, and a run of consecutive PRs may instead be a range, `[#A](url)–[#B](url)`; a session that shipped none has `—`. Sessions 18 to 43 mostly write the link text as `PR #N`. Sessions 42, 43, 47 and 48 have no PRs cell and link their PRs in the Headline, and Session 50's cell adds "(opened later)" after its link. Rows append in session order; this file has no pruning discipline of its own — if it ever needs one, `git log` is the same overflow valve `PROGRESS.md` uses.

When a session's detail-band entry collapses into a `SESSIONS.md` row, delete its `### Session N+1 loading instructions` block from `PROGRESS.md` in the same commit — it directed a session that already ran, and it's recoverable via `git log -p` if ever needed.

## Why handoff stays manual

Moe keeps manual handoff (`PROGRESS.md` + loading-instructions blocks) as the primary mechanism and **declines LLM-authored handoff automation** — chief-clancy's conclusion, but re-founded on current evidence rather than inherited posture. Researched Session 2 (deep-research pass: live hook docs, published summary-fidelity evidence, cross-tool comparison), tested against chief-clancy's own primary sources (their `.claude/research/session-handoff/` audits, read directly).

**Why the conclusion holds — and where its original reasons needed updating:**

1. **The tooling-maturity reason is stale on the hook side.** The substrate chief-clancy evaluated bundled the Routines cloud substrate (research preview as of 2026-04) with a `PostCompact` hook; moe's candidate mechanism needs only the hook half, and that half is now first-class. As of July 2026, Claude Code's hook reference ([code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)) documents a shipped `PostCompact` event (`manual`/`auto` matchers) and `SessionStart` with a `compact` matcher that injects context via stdout/`additionalContext` — the read side of automated handoff is a non-beta capability (only agent-type hooks carry an experimental label; Routines' current status was not re-verified and isn't needed). Automated handoff is buildable today; the question is whether it's advisable.
2. **"Unproven summary quality" has hardened into measured-risky, and the failure mode is omission, not fabrication.** LLM compaction summaries are unpredictably lossy — retention follows the summarizer's in-the-moment salience judgment, and omissions are undetectable from the compacted context alone (arXiv 2606.11213, adversarially verified; its kernel case study shows a summary keeping the prose "what" while dropping the structural detail the next task needed). Consistent with that, reported but not independently re-verified: ~91% faithfulness vs ~50% completeness across nine summarizers, worst on long inputs (arXiv 2409.19898); the best production compression strategy scoring 3.70/5 on functional preservation with file/artifact state the worst dimension at 2.19–2.45/5 (Factory AI, 36k+ production coding-agent messages); hallucination detectors near chance (55% F1, FaithBench) — so a bad summary can't be cheaply machine-caught. First-party failure reports exist against Claude Code's own auto-compact ([anthropics/claude-code#13112](https://github.com/anthropics/claude-code/issues/13112)).
3. **Chief-clancy's 40-session measurement says automation solves the wrong problem.** Across four audited 10-session windows: **0/40 unplanned compactions** — the harm a `PostCompact` backstop addresses never fired once. Handoff cost grew (≈5k → ≈27k tokens median) but their cause analysis attributed it to information density (sessions doing more), which automation cannot reduce: it removes ~1 minute of human latency and none of the authoring cost. Their final audit recommended formally retiring the workstream, not just deferring it.
4. **The industry converges on moe's existing shape.** Cline's official continuity mechanism (Memory Bank) is manual, user-triggered structured markdown — the same shape as `PROGRESS.md`; third-party writeups describe Cursor and Devin Desktop sessions as starting fresh, with continuity supplied by workspace files and rules rather than automated summaries (vendor-adjacent sources — hold loosely). Published practitioner workflows replace `/compact` with manual handoff files. Automated-summary systems do exist (claude-mem's Stop-hook checkpoint summaries), so this is a considered decline, not a capability gap.
5. **The asymmetry cuts against replacing what works.** The manual author is the session that did the work, writing at a phase boundary while context is still good, exercising judgment about what the next session specifically needs. An automated summarizer runs at the worst moment (post-compaction), with no notion of moe-specific salience, and its errors surface only as next-session confusion — on a surface no review gate covers. Moe's own record, dated 2026-07-09: every cold-load to that point had worked end-to-end with zero clarifying questions (n=1 at that date).

**What moe does not import, and where that has since partly changed:** chief-clancy's handoff-_cost_ thresholds and backfilled metric fields stay declined — their own 8k-token handoff-cost threshold drifted out of meaning as sessions got heavier, and their backfill discipline collapsed (19/20 metric fields left TBD across their last two audited windows); a protocol that decays silently is worse than none. But this is now a **partial** supersession, not the original blanket position: PCR's context-size handoff triggers are a separate, handoff-_timing_ mechanism, not a bookkeeping habit — moe has recorded a Session data line since Session 46 (in anticipation of the handoff doc), and Alex's Session 46 scope call (a PCR-style handoff doc with per-session token records, `git show 5f63516:PROGRESS.md`) and his Session 47 expansion to PCR's usage-aware handoff (`docs/history/SESSIONS.md` Session 47) adopted the per-session record that PCR's own §6 defines. Only the original Rationale 4 wording — adopting "event-based triggers (below) instead of a per-session bookkeeping habit" (`docs/decisions/SESSION-HANDOFF-AUTOMATION.md`) — is superseded, and only in its decline of the per-session record, by that Session data line — the revisit triggers below are unchanged.

**Revisit triggers — event-based, recorded in `PROGRESS.md` when one fires.** Some of the Session data fields (Session data and the ten-session review above), written at each handoff, record part of the evidence: "structural warning signs" logs any auto-compaction (the core's section 1 trigger 5), the event behind the first trigger, and "clarifying question needed" (widened at the second review to include a fact found wrong or missing at load) covers the second trigger for the last entry only: an error in an older entry found later (LLLLL: Session 60's, found in Session 66) falls outside it. No field covers the third trigger directly, but the gap between the fire-point figure and tokens at handoff is its nearest proxy. That gap also holds other work when a PR opens inside it (Session 64 ~11k, Session 65 ~13.4k). The triggers:

- An unplanned compaction costs real state (work redone, a decision lost).
- A cold-load fails: the next session needs clarifying questions, or catches factual errors in `PROGRESS.md` (chief-clancy's one real quality incident was exactly this — three factual errors in a handoff entry, caught at next-session load).
- Handoff authoring visibly crowds out end-of-session work, repeatedly.

One firing is a data point, not a build order; a second of the same class is a design signal. If anything does get built, deterministic mechanisms (e.g. a `SessionStart(compact)`/`PostCompact` hook injecting a **pointer** to `PROGRESS.md` — no LLM authorship, so none of the summary-quality risk above applies) are preferred over LLM-generated summaries, and it enters `BUILD_PLAN.md` as its own chunk with Alex's sign-off, not as a rider on other work.
