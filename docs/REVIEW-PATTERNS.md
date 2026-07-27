# Review Patterns

Recurring findings from DA review, `copilot-surrogate`, and self-review across sessions. When dispatched, `.claude/agents/da-review.md` instructs the reviewer to read this file as part of its brief. When the same class of issue is caught 2+ times, add it here with the PR citation.

This is a **living document** — add patterns from real catches, not hypotheticals, with one deliberate exception: the five patterns below are **pre-seeded per `docs/VISION.md` §12**, which names them explicitly as "the highest-confidence failure classes … so the review agent has something to consult on day one" (the ellipsis stands in for §12's own five-item parenthetical, which lists the same five patterns). Some describe functionality that doesn't exist yet (a persona doesn't exist until Stage 5) — they're seeded ahead of any real catch, not evidence of one. The core-hours guard itself now exists (`BUILD_PLAN.md` chunk 2.7a) — its own pattern entry below reflects that; as of `BUILD_PLAN.md` chunk 3.4a-i, that pattern's _predicted failure_ (a new proactive call site skipping the check) has actually fired once, on the guard's first real consumer (see its `Caught:` status below) — the other four pre-seeded patterns below remain unobserved. Each pattern says so explicitly rather than pretending to a track record moe doesn't have yet. Once a pre-seeded pattern is actually triggered by a real PR, replace its "pre-seeded" marker with a real `Caught:` citation — that's the moment it graduates from anticipation to evidence.

**Adapted from chief-clancy's own `docs/REVIEW-PATTERNS.md`** for structure and the "living document" convention only — its actual catches (CLI installer file-list sync, VERSION-marker paths per package, workflow-markdown step-renumbering) are chief-clancy's own history and don't transfer; moe has no CLI installer and no multi-package workflow-markdown surface to have caught those on.

---

## Persona prompts

### Persona-prompt drift

A persona's synthetic unit tests, shaped to match its output schema, can pass 100% green while the persona's actual prompt behavior has drifted from that schema — a synthetic test built from the schema's own shape can't catch a prompt↔schema mismatch, because it never exercises the real model. Only a recorded replay of the actual prompt (chunk 5.4's persona-replay harness) can catch this class.

Watch for: a persona `prompt.md` edit (`packages/agents/src/personas/*/prompt.md` — a do-not-touch surface, Alex's explicit approval required) that lands without a corresponding replay re-recording. `docs/GIT.md`'s "executable markdown" rule already routes prompt edits through the PR flow; this pattern is the specific thing to check once they're there.

**Status: pre-seeded, not yet triggered.** No persona exists before Stage 5 (`BUILD_PLAN.md` chunk 5.3), so this pattern has nothing to catch yet. Seeded now per `docs/VISION.md` §12 so the review agent already has it in scope when 5.3 lands, rather than learning it after the first incident.

### Recorded-transcript drift

Related to persona-prompt drift, but specifically about the replay fixtures themselves: a recorded transcript captured against an OLD prompt version keeps "passing" after the prompt changes, because replay tests replay recorded data, not live model output. A stale recording gives false confidence about the _current_ prompt's behavior while actually testing a prompt version that no longer exists.

Watch for: any `prompt.md` change (see above) that doesn't re-record its persona's replay fixtures in the same PR, per `docs/CONVENTIONS.md` §Testing Standards ("Any persona prompt change needs a replay pass, not just green synthetic tests").

**Status: pre-seeded, not yet triggered.** No replay harness exists before chunk 5.4. Seeded alongside persona-prompt drift since they're the same underlying risk viewed from two angles — the prompt side and the fixture side.

## TypeScript / ESM

### ESM `.js` extension slips

Moe is NodeNext/ESM throughout (`tsconfig.base.json`) — every relative import needs an explicit `.js` extension pointing at the compiled output path, even though the source file is `.ts` (`import { x } from './foo.js'` where the source is `foo.ts`). A slip — an omitted extension, or a `.ts` extension written literally — can pass `tsc` under some configurations but breaks at actual ESM runtime resolution, since Node's own module loader (not TypeScript's) is what enforces this at run time.

A related, already-real gotcha from moe's own history: chunk 0.2's `n/no-path-concat` ESLint rule needed `import.meta.dirname` specifically, not `__dirname` — `__dirname` doesn't exist in real ESM and the rule's own reference-tracking silently didn't fire on it. Any code reaching for a CommonJS-shaped global is the same class of slip, just one step earlier than an import statement.

**Status: pre-seeded per `docs/VISION.md` §12, no incident yet** — moe's own package scaffolding (chunks 0.1–0.3) has been consistent about `.js` extensions throughout, but the pattern is worth having in scope before the first real slip, not after.

### Schema/type separation

A hand-written TypeScript `type` and the Zod schema meant to validate the same shape can drift apart silently — the schema says a field is required, the hand-written type says optional, and nothing catches the mismatch until a value that satisfies the type but fails the schema (or vice versa) reaches production. `docs/CONVENTIONS.md` §Zod already states the fix (derive the type from the schema, `z.infer<typeof Schema>`, don't hand-maintain a parallel type) — this pattern is the failure mode that rule exists to prevent.

A sibling case: validating a Slack/GitHub/status-claim payload at one call site but not a second call site that handles the identically-shaped external data — a schema-pair problem in the sense `docs/DA-REVIEW.md` §Schema-pair check already names (two sections describing the same accept/reject set, read separately, drifting apart).

**Status: pre-seeded per `docs/VISION.md` §12, no incident yet** — moe's first Zod schema doesn't land until chunk 1.1.

## Core-hours guard

### Business-hours guard misses

The shared core-hours/weekend/UK-bank-holiday module exists as of `BUILD_PLAN.md` chunk 2.7a (`packages/core`'s `evaluateOperatingRhythm`) — every persona-initiated proactive behavior is supposed to consult it before firing, per `docs/VISION.md` §14's hard weekend/bank-holiday rest rule and §6.4's delegation of the concrete parameters to that chunk. The failure mode: a new proactive call site added later (an intake draft, a ceremony trigger, a stall ping, anything added well after 2.7a ships) is easy to write as a plain "send this now" without threading the guard check through, especially if the new code is added by someone who never read 2.7a's own chunk text.

**Reactive paths are a deliberate exception, not a miss** — a DM reply (2.7a), a reaction-outcome dispatch (3.4a-iii/3.4b-ii), and a DM-triggered intake draft or confirming question (3.7) all proceed regardless of core hours, since each is a direct response to a human action rather than Moe acting unprompted.

**But do not let that exception do your reviewing for you — that is this pattern's own second, subtler failure mode.** The sentence above is exactly the kind of wording a reviewer can reach for to close a question they never actually asked. Two specific ways it misleads:

- **"Reactive" is a claim about the code path, not a property you can assume from the file it lives in.** Check that the path really is triggered by a human message. A ceremony or sweep that happens to be _implemented_ near reactive code is still proactive.
- **The exemption covers rest, never spend.** Skipping `evaluateOperatingRhythm` is not licence to skip `checkCostCapAndAlert`. `apps/server`'s `evaluateCostAndRhythmGuard` deliberately bundles the two, so "this path is reactive, so it doesn't call that function" can silently mean the cost cap went with it. Chunk 3.3's own DA review caught a real, billed, completely uncapped Anthropic call that shipped for structurally this reason.

Watch for: any new function that posts to Slack, opens a GitHub comment, or otherwise initiates contact on a persona's own timing (not in direct response to a human message) without a visible call into the core-hours guard — **and**, on any path claiming the reactive exemption, any billed LLM call without its own visible cost-cap check.

**Status: Caught — `BUILD_PLAN.md` chunk 3.4a-i**, the first real consumer wired against 2.7a's guard (the ticket-draft composition in `apps/server/src/handle-ambient-channel-message.ts` — `composeAndLogDraft` when 3.4a-i built it shadow/log-only, `composeAndPostDraft` since 3.4a-iii made it post for real). The predicted failure happened exactly as described: the chunk's own first implementation pass wired the High-band auto-draft action without threading `evaluateOperatingRhythm` through it at all — caught by the author during pre-PR docs sync (re-reading `BUILD_PLAN.md`'s own chunk text against the code), not by a reviewer, and fixed before the diff was ever reviewed. The pull loop (6.1a-i) and the ceremony scheduler (7.2a) are still open future call sites this pattern should keep watching.

---

## Test placement

### Extracted function ships without a co-located test file

`docs/CONVENTIONS.md` requires a unit test for every exported function, no exceptions. The failure mode is specific and does **not** look like missing coverage: a function extracted out of a larger file (to stay under `max-lines`, or because a second consumer appeared) arrives already exercised through its original caller's test file, so the suite stays green, the diff adds no untested behaviour, and nothing flags it. The gap is structural rather than behavioural — the new module has no test file of its own, so the next change to it is reviewed against assertions living somewhere else, written for a different caller's concerns.

Watch for: any new `src/*.ts` in a diff whose sibling `src/*.test.ts` is absent — particularly when the commit message or TSDoc describes the change as an "extraction", a "pure move", or "purely to stay under `max-lines`", since all three phrasings signal exactly this situation and simultaneously argue the change is too mechanical to need tests.

**Status: Caught — three times, in the same class.** (1) `BUILD_PLAN.md` chunk 3.4a-i: `handle-ambient-channel-message.ts` was extracted from `handle-inbound-message.ts` and tested only through the latter; DA flagged it, and it was deferred as "a file-organization gap, not a coverage gap" — the reasoning that lets this recur. Its test file exists now. (2) and (3) chunk 3.7: `classify-message-for-intake.ts` and `generate-and-post-reply.ts`, both extractions, both shipped covered only indirectly, both caught by DA on the same PR and fixed there. The third occurrence is what moved this from a one-off judgement call to a pattern: "it's only a move" is true and still leaves the gap.

## How this file is used

- When dispatched, `.claude/agents/da-review.md` reads `docs/DA-REVIEW.md`'s targeted sections, the `docs/CONVENTIONS.md` sections the diff touches, and this file as part of the standard brief; `docs/RATIONALIZATIONS.md` is consulted only when about to dismiss a finding.
- When a new pattern emerges from a real catch (2+ occurrences of the same class), add it here with the PR citation. The five pre-seeded patterns above are the one exception to the 2+-catches bar — once one of them actually fires on a real PR, replace its "pre-seeded" status line with a real `Caught:` citation instead of adding a duplicate entry.
- Patterns that become repo conventions should be promoted to `docs/CONVENTIONS.md`, `docs/DA-REVIEW.md`, or `docs/SELF-REVIEW.md` and removed from this file.
