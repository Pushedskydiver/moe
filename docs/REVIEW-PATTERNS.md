# Review Patterns

Recurring findings from DA review, `copilot-surrogate`, and self-review across sessions. When dispatched, `.claude/agents/da-review.md` instructs the reviewer to read this file as part of its brief. When the same class of issue is caught 2+ times, add it here with the PR citation.

This is a **living document** — add patterns from real catches, not hypotheticals, with one deliberate exception: the five patterns below are **pre-seeded per `docs/VISION.md` §12**, which names them explicitly as "the highest-confidence failure classes … so the review agent has something to consult on day one" (the ellipsis stands in for §12's own five-item parenthetical, which lists the same five patterns). Some describe functionality that doesn't exist yet (a persona doesn't exist until Stage 5) — they're seeded ahead of any real catch, not evidence of one. The core-hours guard itself now exists (`BUILD_PLAN.md` chunk 2.7a) — its own pattern entry below reflects that; as of `BUILD_PLAN.md` chunk 3.4a-i, that pattern's _predicted failure_ (a new proactive call site skipping the check) has actually fired once, on the guard's first real consumer (see its `Caught:` status below) — the other four pre-seeded patterns below remain unobserved. Each pattern says so explicitly rather than pretending to a track record moe doesn't have yet. Once a pre-seeded pattern is actually triggered by a real PR, replace its "pre-seeded" marker with a real `Caught:` citation — that's the moment it graduates from anticipation to evidence.

**Adapted from chief-clancy's own `docs/REVIEW-PATTERNS.md`** for structure and the "living document" convention only — its actual catches (CLI installer file-list sync, VERSION-marker paths per package, workflow-markdown step-renumbering) are chief-clancy's own history and don't transfer; moe has no CLI installer and no multi-package workflow-markdown surface to have caught those on.

---

## Persona prompts

### Persona-prompt drift

A persona's synthetic unit tests, shaped to match its output schema, can pass 100% green while the persona's actual prompt behavior has drifted from that schema — a synthetic test built from the schema's own shape can't catch a prompt↔schema mismatch, because it never exercises the real model. Only a recorded replay of the actual prompt (chunk 5.4's persona-replay harness) can catch this class.

Watch for: a persona `prompt.md` edit (`packages/agents/src/personas/*/prompt.md` — a do-not-touch surface, Alex's explicit approval required) that lands without a corresponding replay re-recording. `docs/GIT.md`'s "executable markdown" rule already routes prompt edits through the PR flow; this pattern is the specific thing to check once they're there.

**Status: live, mechanism built (chunk 5.4).** `docs/decisions/PERSONA-REPLAY-HARNESS.md` — a committed-JSON-fixture replay harness (`packages/agents/src/persona-replay/`), a manual recording script (`pnpm --filter @moe/agents record:replay -- <personaId>`), and a per-persona `persona-replay.test.ts` wired into `pnpm test` (no live network, CI-blocking on every PR). Sarah, Maya, Marcus, Riley, Priya, Dom, and Theo are all backfilled (7 scenarios each for Sarah/Maya/Marcus, 8 each for Riley, Priya, Dom, and Theo, grounded in their real shipped prompts — including a permanent regression fixture for Maya's own PR #91 banter-honesty fix). A `prompt.md` edit that lands without a corresponding re-recording now fails CI directly via the staleness gate below, not just via reviewer discipline. Nia has no scenarios yet — add them the day she gets a real `prompt.md`.

### Hardcoded persona-count in code comments

A TSDoc/comment describing how many personas still fall back to the generic placeholder template (e.g. "the 7 personas without a `prompt.md` yet") is accurate only at the moment it's written — every 5.3 sub-chunk that lands a new real `prompt.md` changes the true count, and nothing forces the comment to update. The code itself has no bug (it always does a real file read/fallback regardless of what the comment claims), so the staleness is invisible to tests and only catchable by a reviewer actually checking the number against the current roster state.

Watch for: any comment or TSDoc in `packages/agents/src/*.ts` naming a specific count of drafted/undrafted personas, on a PR that lands a new persona `prompt.md` — the count is provably wrong the moment that PR merges, whether or not the PR's own diff touches the file containing the comment.

**Status: Caught, on the fourth consecutive miss.** `placeholder-system-prompt.ts:58`, `compose-ticket-draft.ts:136`, and `fetch-persona-prompt-content.ts:15,22` each hardcoded "7" (personas without a `prompt.md`) when written at Sarah's original 5.3a-ii PR — accurate for one moment, then wrong at Maya's PR (#89), wrong again at Marcus's (#92) and Riley's (#94), each landing without catching it. Caught by `da-review`'s R2 pass on Priya's PR (#95, BUILD_PLAN 5.3e), which would have been the fifth miss. Fixed in the same PR by rewording all three to "any persona without a `prompt.md` yet" / "whichever ones don't have a `prompt.md` yet" — count-agnostic phrasing that can't drift on a future 5.3 sub-chunk, rather than another one-off number update.

### A factual claim in shared persona-prompt boilerplate goes stale silently across the whole fleet

The "Triage voice" section is near-identical boilerplate copied into every persona's `prompt.md` (High/Mid/Low band handling), not independently authored per persona. A factual claim baked into that shared text at Sarah's original 5.3a is just as invisible to drift-detection as a hardcoded count (above) once the underlying code it describes changes shape — nothing forces six-plus copies of the same sentence to stay in sync with the code, and a synthetic/schema-shaped test can't catch a prose claim being wrong about implementation detail.

Watch for: a persona prompt's own prose describing _which file or mechanism_ computes something (a confidence score, a band, a routing decision), or _what shape_ a downstream call site's output can take — these are the two riskiest kinds of implementation-detail claims to embed in character-voiced text, because they're accurate at write time and have no test coverage keeping them accurate afterward.

**Status: Caught, BUILD_PLAN 5.3g, by a spec-grill codebase claim-extraction pass on Theo's draft.** Two real inaccuracies, both present verbatim across all six previously-shipped prompts (Sarah, Maya, Marcus, Riley, Priya, Dom), not introduced by Theo's own draft: (1) "a separate, already-calibrated mechanism (`classify-message-confidence.ts`)" named the wrong file for where the High/Mid/Low **band** is actually computed — `classify-message-confidence.ts` only returns a raw numeric score; the band itself comes from `classifyConfidenceBand` in `packages/core/src/confidence-band.ts`, a different file in a different package. Fixed by dropping the specific filename entirely ("a separate, already-calibrated pipeline upstream of you") rather than naming a second specific file, so the sentence can't drift again if the pipeline is refactored further. (2) The High-band paragraph's "Lead with the action: you're drafting this, then the specific line(s) that told you so" described narration `compose-ticket-draft.ts`'s own fixed `DRAFT_SYSTEM_PROMPT` structurally cannot produce — the actual output is a `{title, body}` pair required to restate the message plainly, with no field for meta-commentary about why a draft was made. Fixed by rewording to describe what the draft actually is ("The draft itself restates the message plainly — a title and a short body, no invented cause or detail beyond what's actually there"). Both fixes applied identically across all seven persona prompts in the same PR, triggering a full fleet-wide replay re-recording (see Recorded-transcript drift, below, for how that gate behaved).

### Recorded-transcript drift

Related to persona-prompt drift, but specifically about the replay fixtures themselves: a recorded transcript captured against an OLD prompt version keeps "passing" after the prompt changes, because replay tests replay recorded data, not live model output. A stale recording gives false confidence about the _current_ prompt's behavior while actually testing a prompt version that no longer exists.

Watch for: any `prompt.md` change (see above) that doesn't re-record its persona's replay fixtures in the same PR, per `docs/CONVENTIONS.md` §Testing Standards ("Any persona prompt change needs a replay pass, not just green synthetic tests").

**Status: live, mechanism built (chunk 5.4), and confirmed working against a real post-5.4 edit to already-shipped prompts.** Structurally, not just procedurally, closed: each fixture stores a SHA-256 hash of the `prompt.md` content (and the scenario's own input, and the resolved model id) at record time, and `verifyReplayFixture` fails CI loudly — naming the re-record command — the moment any of the three drift, rather than silently replaying stale data forever (`docs/decisions/PERSONA-REPLAY-HARNESS.md` decisions 3/7). **First real trigger: BUILD_PLAN 5.3g**, when a fleet-wide Triage-voice text fix (below) edited Sarah's, Maya's, Marcus's, Riley's, Priya's, and Dom's already-shipped `prompt.md` files in the same PR as Theo's own new one — the staleness gate correctly failed all six personas' replay tests immediately (wrong `promptContentHash`), exactly as designed, and stayed failing until every affected persona's fixtures were re-recorded against the real API.

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

---

## Review & fold discipline

### Over-correction: a fix for a false claim can be false in a new way

A reviewer (DA, `copilot-surrogate`, or R2) flags a factual claim as false. The fix lands, and a later independent pass finds the fix is _also_ false — not the same error restored, but a different one, often the mirror image of the first. The failure is specific to _prose fixes_, not code: a code fix that breaks something usually fails a test; a doc/comment fix that overstates or overcorrects has no equivalent backstop, so it ships clean until the next fresh-context read.

**Why it recurs, structurally:** fixing a reported claim carries an attention asymmetry — the author is now anchored on _the specific error just named_, which is exactly the frame most likely to produce an equal-and-opposite overstatement rather than the accurate middle. This is the same mechanism `docs/DEVELOPMENT.md`'s Round-2 rule exists for on the code side ("the last discovery round has a self-terminating bias built in"); this pattern is that same bias, observed specifically in prose corrections.

**A related, second failure mode worth watching for together:** the same debunked claim surviving as an untouched sibling — a fix corrects one location and a comment or doc elsewhere keeps asserting the original, now-contradicted claim, because the fix's own scope never swept for it. `docs/DA-REVIEW.md` §Claim-extraction's quoted/attributed-claim bucket already names this for quotes; it applies identically to any corrected factual claim, code comments included.

Watch for: a fix commit whose message describes correcting a reviewer finding, especially one using an absolute word ("never", "always", "only", "invisible", "nothing") in the _replacement_ text — that word is the shape of the next overstatement. And after any such fix, grep the whole repo for the debunked claim's own distinctive wording, not just re-read the file that was corrected.

**Status: Caught — at least four times across two PRs**, three within one PR (`BUILD_PLAN.md` chunk 3.9, [PR #77](https://github.com/Pushedskydiver/moe/pull/77)) in immediate succession, which is what moved this from an isolated incident to a pattern:

1. **[PR #72](https://github.com/Pushedskydiver/moe/pull/72)** (chunk 3.7, whose own docs referenced the then-still-unbuilt chunk 5.2a): a `copilot-surrogate` finding ("channels are held by 5.2a" — false) was corrected into its exact mirror image, caught by a second surrogate pass on the same PR. PR #72 shipped chunk 3.7, not 5.2a — the misreadable parenthetical this line itself originally carried was caught the same way everything else in this entry was, by asking a fresh reader to check it rather than trusting the label.
2. **PR #77, `review-queue-sweep.ts`'s section-ordering comment**, corrected three times in sequence before converging: an original false universal ("every other value records a message already judged not to warrant one" — false for `'mid-silence'`/`'mid-yes-failed'`) was replaced with a _different_ false universal ("every other value records an exchange that did happen" — false for `'low-confidence'`, which has no exchange at all), caught by a fresh R2 pass; the two-conjunct replacement fixed the substance but miscounted the Mid-band total ("the three Mid-band values" when there are four), caught by a scoped `copilot-surrogate` re-dispatch.
3. **PR #77, `docs/OPERATIONS.md`'s rollback-consequence note**, corrected three times: v1 claimed a `fly deploy` rollback "breaks the sweep" (false — the deployed process never reads `review_queue`) and that a partial failure "writes nothing" (false — it does, via a different write path); the v2 fix for the first half then claimed the rolled-back behavior produces "no error, no log... it is invisible" (false — it logs, misleadingly), caught by R2; the v3 fix for _that_ then claimed "nothing is persisted... silent in the database" (false — a cost-usage row is still written, unconditionally, before the guard runs), caught by a narrowly-scoped terminal check.
4. **PR #77, a sibling instance of the debunked "hid this bug in production for two days" claim** (itself removed from `docs/OPERATIONS.md` as part of fixing instance 3): survived untouched in a `standing-proactive-guards.test.ts` code comment, introduced by the PR's own first commit, missed by three consecutive correction rounds because none of them grepped the repo for the claim's own wording — found only when the terminal R2 pass swept for siblings on its own initiative, per this pattern's second failure mode above.

## How this file is used

- When dispatched, `.claude/agents/da-review.md` reads `docs/DA-REVIEW.md`'s targeted sections, the `docs/CONVENTIONS.md` sections the diff touches, and this file as part of the standard brief; `docs/RATIONALIZATIONS.md` is consulted only when about to dismiss a finding.
- When a new pattern emerges from a real catch (2+ occurrences of the same class), add it here with the PR citation. The five pre-seeded patterns above are the one exception to the 2+-catches bar — once one of them actually fires on a real PR, replace its "pre-seeded" status line with a real `Caught:` citation instead of adding a duplicate entry.
- Patterns that become repo conventions should be promoted to `docs/CONVENTIONS.md`, `docs/DA-REVIEW.md`, or `docs/SELF-REVIEW.md` and removed from this file.
