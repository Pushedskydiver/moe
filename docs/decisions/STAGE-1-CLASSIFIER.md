---
status: Decided
date: 2026-07-18
---

# Stage-1 Classifier — Scoring Method & Thresholds

## Decision

Closes VISION §5.2's open question with two discrete calls: **scoring method** is a single bundled structured-output call returning one integer confidence score 0–100 (no separate scoring call, no log-probs, no prefill), on **Claude Haiku 4.5**; and **thresholds** are **High ≥ 70, Mid 35–69, Low < 35**. Grounded in a live 24-message eval against the real Claude API (BUILD_PLAN chunk 3.1's own "small offline eval set of real-ish messages" requirement), not decided from theory alone.

## Context

VISION §5.2 named three candidate scoring methods without picking one — "model-reported probability vs. a separate scoring call vs. log-probs" — and left the High/Mid/Low thresholds unset, both explicitly blocking §5's implementation. Two of the three candidates turned out not to be real options once checked against the actual Claude API (verified via the `claude-api` skill's current reference, not assumed from memory):

- **Log-probs don't exist.** The Anthropic Messages API has never exposed token-level log-probabilities, unlike OpenAI's API. Nothing in the current API surface (structured outputs, streaming, tool use) offers a log-prob field.
- **Prefill is dead on every current-generation model.** Assistant-turn prefill (the classic pairing with log-probs-style techniques) returns a 400 on Fable 5, Opus 4.6/4.7/4.8, and Sonnet 4.6/5 — the entire family moe would plausibly use.

That leaves "model-reported probability" and "a separate scoring call" as the only real candidates — and they turn out to be the same underlying mechanism (ask the model to state a number) at two different points in the pipeline: bundled into the classification call itself, or split into a dedicated second call. Alex confirmed the bundled approach via `AskUserQuestion` before the eval ran, matching VISION §5.2's own "a fast, cheap model call" framing for Stage 1 — a second call doubles latency and cost per message for no accuracy benefit this eval identified.

## Method

Real Claude API calls (not simulated), one classification call per message, using `output_config: {format: {type: "json_schema", schema}}` (structured outputs — a real API feature, not a workaround) requiring `{confidence: integer, reasoning: string}`. System prompt: _"decide which messages describe actual work that needs doing... versus general conversation, social chat, or commentary that doesn't need any action."_

**24-message synthetic eval set** (Alex confirmed synthetic over sourcing real historical messages, via `AskUserQuestion`) — 8 clear work requests, 8 clear banter/social messages, 8 deliberately ambiguous/borderline messages (a mix of soft-pedaled bug reports, discussion questions, and genuinely non-actionable but work-adjacent chatter) — run against **both Claude Haiku 4.5 and Claude Sonnet 5** for a real cost/accuracy comparison, not an assumed one.

## Decisions

1. **Scoring method: one bundled structured-output call, single 0–100 integer.** Matches VISION §5.2's "one score in, three bands out" literally — the model's only output is the number (plus a `reasoning` string for debuggability, not itself part of the routing decision). No separate scoring call, no log-probs, no prefill — see Context above for why the other two candidates aren't viable on the current API.

2. **Model: Claude Haiku 4.5.** Real eval data, not a guess: Haiku showed a **cleaner separation gap** than Sonnet 5 across the same 24 messages — every banter/non-actionable message scored ≤ 35, every genuine-work message (including ambiguous-but-real ones like "footer links look broken" and "keep getting logged out") scored ≥ 72, leaving a clean unoccupied band from 35–72 in the real data. Sonnet 5 showed a messier spread (its own "coffee machine" outlier landed at 55, squarely inside its ambiguous cluster, and its work-category floor was lower at 78 vs Haiku's 85). Haiku is also ~2–3× cheaper per token — for a gate VISION §5.2 explicitly wants "fast, cheap" and that runs on every in-scope message, not just addressed ones, the cheaper model winning on the actual eval data (not just cost) makes this an easy call. Rejected: Sonnet 5 (moe's already-adopted chat-turn model, VISION §11) — no accuracy advantage observed on this eval to justify the extra cost for a high-volume gate.

3. **Thresholds: High ≥ 70, Mid 35–69, Low < 35.** Set inside the real 35–72 gap in Haiku's own eval output, with margin on both sides rather than sitting on the exact boundary values observed. Every one of the 8 "work" messages and every ambiguous message that was actually a real bug report scored ≥ 72 on Haiku (comfortably above 70); every banter message and every ambiguous message that was genuinely non-actionable scored ≤ 35 on Haiku (at or below the Low ceiling). No message scored by **Haiku** in this eval landed in the 35–70 gap at all — a genuine finding about the chosen model, not a gap in the write-up: this eval set didn't happen to produce a message Haiku scored as a "true toss-up," so the Mid band's real-world population is unverified by this specific eval, and worth watching once real traffic exists (see Triggers below). Sonnet 5's own scores did land several messages in this range (40, 55, 65, 68) — consistent with Decision 2's point that Sonnet's separation was messier, not a contradiction of this finding, which is scoped to the model actually being adopted.

4. **A real finding, not just a threshold input:** the eval's own "coffee machine is broken again" message (labeled banter going in) scored 35 (Haiku) and 55 (Sonnet) — both models scored it meaningfully higher than every other banter message. This is arguably the _model_ being right and my own label being the weaker ground truth — a broken coffee machine is a low-priority but real facilities complaint, not pure social chat. Left in the eval set and in the "banter" category as originally labeled (changing labels post-hoc to match model output would defeat the point of an independent eval), but flagged here as a concrete illustration of why VISION §5.2 rejected a binary yes/no gate: a numeric score captures exactly this kind of real, non-binary distinction a boolean would flatten.

## Deferred / explicitly rejected

- Per-persona or per-channel threshold tuning is out of scope here — VISION §5.2 doesn't ask for it, and this ADR's job is closing the blocking open question, not designing a tuning system BUILD_PLAN hasn't scoped.
- A larger, more statistically rigorous eval set (100+ messages, inter-rater labeling) was considered and rejected for this chunk — BUILD_PLAN 3.1 explicitly scopes this as "a small offline eval set," a spike to unblock implementation, not a permanent calibration benchmark. Real production traffic (chunk 3.3's classifier gate, run silently for a few days before 3.4a-i acts on it) is the mechanism BUILD_PLAN already names for larger-scale validation.
- Re-scoring the "coffee machine" message's category label to match model output was considered and rejected (see Decision 4) — an eval that adjusts its own ground truth to agree with the system under test isn't measuring anything.

## Triggers for re-evaluation

- Once chunk 3.3's classifier gate runs against real production traffic (logged, not yet acted on, per BUILD_PLAN's own sequencing) and real messages start landing in the untested 35–70 Mid band — confirm the Mid-band behavior (a confirming question) reads sensibly against real examples, not just the synthetic eval's clean gap.
- If Haiku 4.5 is ever deprecated/retired or a materially cheaper/faster model ships, re-run this same 24-message eval (or an expanded version) before assuming the new model's score distribution matches these thresholds.
- If the ignored/rejected-draft rate VISION §5.4 names as the real production metric shows systematic miscalibration in either direction (drafts too often ignored → High threshold too low; real work silently dropped → Low threshold too high), revisit the specific threshold values, not the scoring method itself.

## References

- `docs/VISION.md` §5.2 (Stage 1 — cheap classification gate) — the open question this ADR resolves.
- `BUILD_PLAN.md` chunk 3.1 — this chunk. Blocks 3.2 (channel scoping), 3.3 (classifier gate implementation), and everything downstream in the intake cascade.
- Claude API structured outputs (`output_config.format`), verified live against the `claude-api` skill's current reference — no log-probs anywhere in the Messages API; assistant-turn prefill returns 400 on every current-generation model.
