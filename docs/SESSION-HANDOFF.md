<!-- synced-docs: SESSION-HANDOFF version 6 sha256 3d7b8cc18f64f5e52444014bd7711e1955744635cdd7d52dcf3fa6a86d03b128 -->
# Session handoff protocol

Claude decides when a session has run long enough, says so in one line, updates `PROGRESS.md`, and gives Alex a prompt to paste into a new session. Alex does not have to call the handoff. A human-readable `PROGRESS.md` is the handoff, not a generated summary.

This is the core of a hub-shaped doc: the AIOS hub's canonical text, of which each repo holds a stamped copy, carried by its `synced-docs` plugin. The project's own settings, which this core calls the local file, are in `SESSION-HANDOFF.local.md` beside it. The core is edited in the hub, never in a copy, and the plugin's drift check warns when a copy differs from its stamp or is behind the canonical (AIOS research/56 §6, Alex, 2026-10-01 and 2026-10-02). The core derives from PCR Formulation's and moe's versions. A citation of the form "AIOS research/NN" is a record in the AIOS repository's `research/` folder.

**Status of the numbers: judgement with a record behind it, not a measurement.** The mechanism is evidenced: reasoning degrades as input grows (arXiv 2402.14848), and recall is worst mid-context (arXiv 2307.03172). Neither paper gives a threshold. PCR's review of 40 sessions (its research/54) found that once the main session orchestrates and subagents do the building, the median handoff was 170k tokens and 1 of 13 went past 250k. When the main session did the building itself (PCR's Sessions 6 to 27), 14 of 22 went past it. moe's Sessions 46 to 53 ranged from about 145k to 300k, and its Sessions 70 to 77 from about 126k to 177k (AIOS research/72 §2.2). Those records describe where handoffs fell, not where they should fall, so the lines are a dial.

## 1. When to hand off: the sooner of

| # | Trigger | Rule |
|---|---|---|
| 1 | **Phase boundary** | A deliverable has shipped (a research round digested, a plan written, a PR opened, a doc loop finished) and the session is 40k tokens or more above its context at load. Hand off before the next phase. A PR opened is the boundary, because Alex merges. |
| 2 | **Soft context line: 150k tokens** | Finish the current unit of work (one committed artefact, such as a report or a fix pass; a doc loop is several units), then hand off. Start no new workflow and no new topic. |
| 3 | **Hard context line: 250k tokens** | Hand off now. Finish only the step in progress. |
| 4 | **Plan usage** | The five-hour window is at 85% or more: start no new multi-agent work, write the handoff, and give Alex the reset time. If either weekly figure is also 85% or more, name it in the notice. Whatever the five-hour window, either weekly figure at 85% or more puts any new multi-agent work to Alex before it starts. |
| 5 | **Structural warning signs** | Any one of: re-reading a file already read this session, asking Alex something already answered, two failed tool calls caused by forgetting an established fact, an automatic compaction, or a second flagged message in the session. These are observable events, not feelings. Self-rated confidence is not a trigger because it is unreliable. After the first flagged message, if the session was switched to an older model, ask Alex to set the model back with `/model`, and record the flag and any switch in Session data (the local file says how a switch is made visible). |
| 6 | **Topic switch** | Alex moves to an unrelated workstream. Offer a fresh session for it. |

In triggers 1 and 2, a doc loop is a review of a doc, then fix passes, each checked by a fresh reviewer, until a check meets the project's stop rule, and any pass that rule asks for after it. The hub's loop and stop rule are in its doc-review plugin's README.

Absolute tokens rather than a percentage, because the window is 1M tokens on the models this doc was written for, and a 60% line would be 600k, far past where quality holds. Trigger 1 counts from context at load, not from zero, because a session that reads its loading docs can start near 100k, where an absolute line is met at load. Handoffs on trigger 1 in AIOS and moe fell about 40k to 60k above load (AIOS research/72 §2.3).

**The main session plans, delegates and decides.** Subagents do the building and write to files: the hub's workers, or a project's own pinned workers, on their pins (the local file), and any other subagent with an explicit `model` from the local file's table. In PCR's record this is what keeps handoffs inside the lines: median 170k and 1 of 13 past 250k with it, against 14 of 22 past 250k when the main session did the building itself (its research/54). A brief to a pinned worker whose agent file has a "Return only" list adds to it only what that run needs, and never restates or widens it. A brief to any other subagent, or to a pinned worker without such a list, gives its own "Return only" list and says the orchestrator will read the file or diff, so the hand-back need not restate it (AIOS research/52). A brief's text is a claim: check every fact and every quoted Fix in it at its source before sending it, because the worker acts on what the brief says (AIOS research/58 §2.5). Check each quoted Fix also against the rules of the doc it lands in, core or local, and the passages beside the edit: a Fix can be right about its finding and still break a rule of the doc it lands in (AIOS research/64 §3.2). Any other text the session writes for someone else to act on is a claim too, such as a PR body or an entry's account of what a doc says: check it at its source before it goes out, and whoever acts on it checks it again (AIOS research/77 §7, Q1).

**How Claude checks.** Once at load, when the loading instructions' reads, this doc and its local file are read, for trigger 1's base and section 4 item 8's context at load. Then at each checkpoint: after digesting a subagent report or any large tool result, before launching a workflow or a subagent, and before starting a new topic.

- **Desktop app:** load `mcp__ccd_session_mgmt__get_usage` with ToolSearch, since it is a deferred tool. It reports context, the five-hour window and the weekly limits (all models, and Fable separately).
- **Terminal CLI:** if ToolSearch finds no `get_usage`, read context from the newest transcript, and ask Alex to run `/usage` at the start and at handoff. If he does not, record "not available (CLI)".
  - Context is `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` on the last main-thread assistant entry, excluding `isSidechain` entries:

    ```bash
    f=$(ls -t ~/.claude/projects/<cwd-slug>/*.jsonl | head -1); jq -c 'select(.type=="assistant" and (.isSidechain|not) and .message.usage) | .message.usage | (.input_tokens + (.cache_creation_input_tokens//0) + (.cache_read_input_tokens//0))' "$f" | tail -1
    ```

  - The context figure lags the tool's by about one turn (moe measured 85,174 against 87,703). Check it again if the transcript format changes.
  - On the CLI, trigger 4 is checked only at the start and at handoff.
- **Both:** at each checkpoint, read the model and effort as run from the newest transcript. This is also how a flag switch is found (trigger 5):

  ```bash
  f=$(ls -t ~/.claude/projects/<cwd-slug>/*.jsonl | head -1); jq -r 'select(.type=="assistant" and (.isSidechain|not) and .message.model and .message.model != "<synthetic>") | [.message.model, (.effort // "none")] | @tsv' "$f" | uniq -c
  ```

- **For either command:**
  - `<cwd-slug>` is the absolute path with each `/`, `@` and space replaced by `-`.
  - If more than one session or headless run uses this project, the newest file may not be this session's. Say so, and do not guess.

## 2. What a handoff consists of

1. **`PROGRESS.md` updated.** This is the real handoff, in the shape in section 4.
2. **Memory current.** Decisions and preferences go to memory, so they load on their own.
3. **Background work declared.** A background subagent dies with its session. Commit its output before the handoff, or declare it re-runnable. A re-runnable job's inputs are committed or kept outside the session scratchpad. At the hard line, do not wait for a running agent: declare it re-runnable and say so in In flight.
4. **Cleanup done:** this session's scratch cleared if no agent still needs it, this session's finished worktrees (the PR merged with the branch's tip as its head, no uncommitted changes, and no ignored file that is neither a copy nor rebuildable) removed with their local branches, and the archive rule applied (section 5, or the local file's own), and the `check-synced-docs` skill run, with any warning it prints listed under Next. Never clear scratch or remove a worktree while a background agent runs. If a background agent is still running at handoff, skip that part and say so in In flight.
5. **A one-line notice to Alex** saying why now, plus the prompt in the local file as a text block to paste into a new session, not a task chip.
6. **The recommended model and effort** for the next session, from the local file's table. Name the effort explicitly, because default effort differs by model and changes with point releases. Prefer `high` for Opus unless there is a stated reason. Workers keep their own pinned model and effort.

Rules for the entry: point to files instead of restating them, separate "done" from "verified", list open questions for Alex instead of assuming answers, and never default silently to a workstream when the next step is unclear. Anything the next session must act on, such as a finding, a decision with its grounds or a judgement, is in a committed file, or the entry gives it one line of substance. A chat, a transcript or a PR body does not outlive the session, so none of them is a record (AIOS research/77 §7, Q2). An entry with no loading instructions is an interim note. The session's handoff rewrites it in the shape in section 4, and "never edit" applies from then on. If Alex keeps the session going after its handoff is written, keep working and write a new entry at the next stopping point. Never edit the earlier one, except that a decision recorded after handoff with no new work adds one dated `Update (date):` line to it and amends its loading instructions. New work gets a new entry.

## 3. The handoff prompt

Kept small, because `PROGRESS.md` carries the state. The project's own text is in the local file.

## 4. Shape of a `PROGRESS.md` entry

1. **One bold sentence:** the single most important fact from the session.
2. **Asked and decided:** with who decided and when, and pointers to the records.
3. **Shipped:** paths, what was verified, and how.
4. **In flight:** background jobs, each marked committed or re-runnable, with where its inputs are (committed, or a path outside the session scratchpad), and what cleanup removed or skipped.
5. **Next:** an ordered list, then the open questions for Alex.
6. **Loading instructions for the next session:** what to read, the live checks to run first (the entry is a snapshot; the local file lists the project's standing ones), the recommended model and effort, and numbered decision branches, marking each that is Alex's to decide. They point to docs and never restate a rule.
7. **Lessons:** short, lettered, written to apply beyond this session.
8. **Session data,** the last field of every entry, the same in every project so that their data compares: tokens at handoff and their source (tool or CLI); context at load, taken at section 1's load check, and its source; the model and effort as run, with the resolved model version, and any mid-session change of either, by Alex or by a flag (section 1's model-and-effort command shows them; the effort is "not visible" only when the entries carry no `effort` field); the five-hour and both weekly percentages; which trigger fired; what grew context most; worker subagent tokens (the total each Agent result reports); structural warning signs or "none"; and whether the next session had to ask a question the entry should have answered. Review every ten sessions and record the result where the project keeps its research records (AIOS: `research/`). The lines are hub-wide, except where Alex's recorded decision gives a project its own line in its local file (AIOS research/56 §6, Q6). The hub-wide lines move only when handoffs in at least two projects cluster well away from them. Two sessions in a row with a clarifying question mean the entry shape needs fixing.

## 5. Keeping the file small: the archive rule

`PROGRESS.md` is read at the start of every session, so its size is a cost every session pays. **When it holds more than 3 entries, or the entries behind the newest total more than 200 lines**, move the oldest entries verbatim into `docs/PROGRESS-ARCHIVE.md` (newest first, oldest last), with no prose change. The newest entry is exempt from the line count, because the next session needs it. When the rule fires, move the oldest entries first, and only entries whose session has read them and written its own entry forward. Stop when the file holds at most 3 entries and the entries behind the newest total at most 200 lines. Check at the start of a session, before picking up any workstream, since a check that happens "when it occurs to someone" backslides. A project's local file may set its own archive rule in place of this one, by Alex's recorded decision, and keeps the check at the start of a session (AIOS research/72 §7, Q2).

The archive is read only when a newer entry points into it. It is frozen history, so it is excluded from any docs-size budget.
