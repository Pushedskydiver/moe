---
status: Decided — narrow the discretion, decline the heavier fixes for now
date: 2026-07-16
---

# Review-Gate Discretion — copilot-surrogate's Trigger

## Decision

Convert `copilot-surrogate`'s discretionary-dispatch case (`docs/DEVELOPMENT.md` step 6) into a mandatory trigger on the same three conditions it already named — no more "dispatch it when worth the cost" cost-benefit judgment call. Decline building a dedicated gate-checker subagent or mechanical CI-enforcement machinery for now. The "don't merge before a dispatched review's result is in hand" discipline (PR #25's own failure mode) needed no new work — it's already codified in `docs/DEVELOPMENT.md` step 8 and the "a dispatched review isn't done" paragraph, both added when PR #26 fixed the gap live.

## Context

Two incidents this session exposed the same underlying pattern — a review-gate step silently not run, or not waited for, rather than a check being run and subverted (a different, already-cited failure mode: `docs/VISION.md` §8's SpecBench finding on self-administered-verification gaming):

1. **PR #24** — `copilot-surrogate` was skipped under the discretionary case. Stated reasoning: "DA + a fresh Round-2 pass already thoroughly checked live SDK behavior, so this would be redundant." Run retroactively, it caught a real MATERIAL bug neither DA nor R2 had checked for, because they check different things.
2. **PR #25** — a DA review was dispatched in the background; the PR merged before its result came back, which arrived afterward with a real MATERIAL finding still unresolved on `main`.

Alex asked for a deep-research pass (practitioner sources: Matt Pocock, Addy Osmani, Simon Willison, Armin Ronacher, Anthropic's own Claude Code/Agent SDK docs; academic: LLM self-monitoring/rule-adherence literature) evaluating three candidate structural fixes: (A) remove the discretion, make `copilot-surrogate` unconditionally mandatory on its existing trigger conditions; (B) a mechanical CI gate requiring machine-checkable evidence a check ran before merge; (C) a dedicated, fresh-context "gate-checker" subagent verifying required steps actually completed. Full evidence: `.claude/research/review-gate-reliability/research-2026-07-16.md` (gitignored, this session's artefact).

## Positions evaluated

|       | Position                                                                           | Verdict                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Narrow the discretion — same trigger conditions, mandatory instead of cost-weighed | **CHOSEN**                                                                                                                                  |
| **B** | Mechanical CI gate requiring evidence a required check actually ran, before merge  | Deferred — real precedent exists (Anthropic's own PreToolUse hooks), but no source sized this against moe's actual PR volume                |
| **C** | Dedicated fresh-context gate-checker subagent verifying required steps completed   | Deferred — strongest direct research support of the three, but real engineering surface for a Stage 0/1, effectively-solo project           |
| **D** | Leave the discretionary judgment call as-is                                        | Rejected — it already failed once, on exactly the framing ("this other check already covered it") the research found empirically unreliable |

## Rationale

1. **The research's own strongest-supported fix (C, enforced through a B-style mechanical block) is real, but it's solving a two-incident problem with permanent new infrastructure.** Building a dedicated gate-checker subagent plus CI enforcement means another agent definition, another doc to keep in sync, and — per the research's own MAST citation (8.2% of 1,642 real multi-agent traces show "No or Incomplete Verification," with verifiers documented to "perform only superficial checks despite being prompted to perform thorough verification") — another thing that can itself decay. Adding a mechanical enforcer _for_ process decay is subject to the same decay risk unless it's dead simple; C+B isn't dead simple.
2. **Osmani's data targets incident 1's actual failure directly.** Across 617 flagged locations from four independent review tools, 93.4% were caught by exactly one tool — the tools never once flagged the same line. "This other check already covered it" is empirically the wrong prior, which is exactly the failure mode A removes: not by making the trigger conditions any more mechanical (they're unchanged — blast-radius docs, bigger diffs, prose/TSDoc claims about the rest of the repo), but by removing the cost-benefit judgment call that overrode them on PR #24.
3. **Incident 2 already has its fix, and it's the cheap one the research itself pointed at.** Anthropic's own multi-agent research system runs subagents synchronously by design, specifically to avoid async result-coordination risk; Claude Code's own headless mode blocks on background subagents whose result is part of the final output. `docs/DEVELOPMENT.md` step 8 and the "a dispatched review isn't done" paragraph (added live, the same day PR #25's gap was found) already require confirming a dispatched review's result is in hand before merge — a discipline fix, not new machinery, and it's held on every PR since.
4. **Proportionality.** Moe is a Stage 0/1, effectively-solo project with low PR volume. The marginal cost of always dispatching `copilot-surrogate` on its existing (already fairly narrow) trigger conditions is negligible at this scale; the cost of building and maintaining a new subagent type plus CI tooling is not. Escalating straight to the heaviest-supported fix before there's evidence the cheap one doesn't hold is the same "add more process because process decays" instinct that's already made this repo's doc set fairly heavy for its size.
5. **The research flagged its own limit here.** No source sized any of the three candidates against moe's actual PR mix, and no source evaluated the three candidates by name — the recommendation for C+B was well-supported analogically, not an empirical result specific to this repo. Declining it isn't rejecting the evidence; it's weighing it against a proportionality question the evidence explicitly couldn't answer.

## What changed

`docs/DEVELOPMENT.md` step 6 — "discretionary case" language ("dispatch it when a second HEAD-scope factual-claim pass is worth the cost") replaced with a mandatory trigger on the same three conditions (blast-radius doc touched, diff >50 LOC, PR's own new prose/TSDoc makes a factual claim about the rest of the repo or an external library). No new agent, no new CI job.

## Triggers for re-evaluation

- The narrowed-mandatory trigger fails again — a PR that meets one of the three conditions still ships without `copilot-surrogate` having run.
- PR volume grows enough that the added dispatch cost (time, compute) becomes a real friction point, not a rounding error.
- A gap surfaces that the mandatory-trigger fix structurally can't catch (e.g. a factual-claim bug in a PR that doesn't meet any of the three conditions) — that would argue for B or C directly, not just a wider trigger list.

One firing is a data point, not a build order; a second of the same class is a design signal. If this decision changes, it enters `BUILD_PLAN.md` as its own chunk with Alex's sign-off — not a rider on other work, matching how `docs/decisions/SESSION-HANDOFF-AUTOMATION.md` already handles this class of decision.

## References

- `docs/DEVELOPMENT.md` §Review Gate — the mechanics this decision edits.
- `.claude/research/review-gate-reliability/research-2026-07-16.md` (gitignored) — the full deep-research artefact this decision draws from.
- `docs/VISION.md` §8 — the SpecBench self-administered-verification-gaming finding this decision's two incidents are explicitly distinct from.
- `docs/RATIONALIZATIONS.md` — "The architectural review said proceed, so it's good" entry, citing PR #24's original skip.
