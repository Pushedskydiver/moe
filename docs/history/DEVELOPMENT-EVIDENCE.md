# DEVELOPMENT.md evidence

History, not live guidance. Incident narratives moved verbatim out of `docs/DEVELOPMENT.md` on 2026-09-27 (from commit `89df804`), so the live doc keeps each rule plus a one-line pointer here — except §Chunk close, which no live doc points to (kept here for history only). Text here is stale by design: inside a quoted span, a relative reference (e.g. "step N", "this step", "item N", "above", "below", "here", "this sentence", "this very file", "this very gap", "this same change") means that commit's `docs/DEVELOPMENT.md`. Read only when a live doc points here.

## Chunk close

From §Quick Reference step 3:

> (the norm since 6.0's PR #99; 6.1d's PR #104 was the exception, closed by a follow-up commit)

## Step 6

From §Review Gate step 6:

> This replaces the old "dispatch when a second pass is worth the cost" framing — PR #24 was skipped under exactly that framing ("DA + R2 already covered it"), and the retroactive run caught a real MATERIAL bug neither had checked for (`docs/decisions/REVIEW-GATE-DISCRETION.md`).

## Pre-merge checkpoint

From §Review Gate step 6:

> Spelled out here rather than left implicit in step 5: chunk 3.7's dispatch was triggered by this step, not step 5, its findings were never posted, and a reader following step 6 alone would have found no instruction to post. Step 5 does explicit carry-over work for R2 and did none for posting; that asymmetry is what this sentence closes.

From §Review Gate's pre-merge checkpoint paragraph:

> On **chunk 5.2a** the surrogate was not dispatched at this step at all (two triggers had fired when the skip happened — size, and repo-factual prose; a third joined once this very file, which is blast-radius, was added to that PR) — a DA→R2 chain had come back clean and that felt like a satisfied gate; it was dispatched only after Alex asked, and its findings are on PR #74. On **chunk 3.7** it was dispatched and its 15 findings were fixed, but they were not posted as a PR comment until Alex asked, well after merge (the comment on PR #72 says so, and says it is late — that is the remedy in item 3, applied).

From the paragraph after the pre-merge checkpoint:

> Step 5 already carries the posting rule and was not the trigger in either case; **step 6, which was, did not carry it until this same change added it** — so 3.7 was a drafting gap as much as an execution one.

From §Review Gate's "specific trap" paragraph:

> On chunk 3.7 a DA pass returned no BLOCKING, a clean R2 followed it, and the surrogate then found a BLOCKING — which is the sharper version of the point, since that R2's brief was confirm-or-disprove rather than discovery and it ran after the fold, so it never had the chance to catch it.

## Comment-title checks

From §Review Gate's pre-merge checkpoint item 3:

> Every shorter form was tried against real PRs and each fails: a bare `.comments | length` counts any comment by any author (#69 and #70 both carry an R2-verification post alongside the surrogate's, so a count of 2 proves nothing about which is which); `test("copilot-surrogate")` over-matches, since those R2 posts mention the surrogate in their own titles; and a tighter `test("copilot-surrogate claim review")` under-matches, missing #69/#70 entirely because the title convention used to read "factual-claim review". A one-line-per-comment listing is short, and it is the only form that survives the title drift.

## Round-2 verification

From §Review Gate's "Round-2 verification, in full" paragraph:

> (caught live, twice, on PR #24: a DA-chain finding got mutation-tested by the same agent that fixed it — reverting the fix, confirming a test would catch the regression, restoring it — instead of a fresh R2 dispatch; a separate, later MATERIAL `copilot-surrogate` finding was fixed with only a new test and no independent check at all, not even self-verification. No bug shipped either time, but the discipline gap was real, and the second instance is the stronger example — it wasn't self-verified by any method, just re-tested)

## Isolation

From §Review Gate's isolation paragraph:

> (caught via `git status`/`git reflog` before any harm, but real, not hypothetical)

> Isolation reduces the risk, it doesn't eliminate it: an isolated agent's own Bash `cd`s have twice wandered back into the primary worktree anyway (confirmed by the agent's own final report both times) — re-check the primary session's `git status --short --branch` after any isolated dispatch that ran Bash commands, don't skip it just because isolation was requested.

From §Review Gate's "worktree-isolated dispatch" paragraph:

> (caught live: a chunk-5.0 R2 pass concluded none of five already-fixed findings existed, because it checked its own isolated worktree instead of the primary checkout where the actual uncommitted edits lived — a corrected re-dispatch with the primary path spelled out confirmed all five were genuinely folded)

## Dispatched reviews

From §Review Gate step 8:

> (caught live: PR #25 merged with a DA dispatch still unresolved, because the background result arrived after Alex had already merged; the process gap that incident exposed — treating a launched dispatch as equivalent to a completed one — is what this sentence exists to prevent next time)

From §Review Gate's "dispatched review isn't done" paragraph:

> Caught live on PR #25: DA was dispatched, the PR was opened and merged before it returned, and it came back afterward with a real MATERIAL finding (this very gap) still unresolved on `main`.
