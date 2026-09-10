// `calibrated-ambiguity-names-and-proceeds`'s stall-detection — a saga worth naming plainly, seven
// review rounds deep, each finding a real (if progressively narrower) false-pass: R1 a keyword-
// presence check trivially true on a stall; R2 confirmed the fix was still trivially true; R3
// found bare `report_status` tool-use doesn't discriminate a real plan from a sanctioned "blocked"
// claim through the same tool; R4 found negating the claim's own "ready" defeats a bare keyword
// check; R5 found the negation guard applied to "ready" but not its sibling "blocked", plus an
// unanchored "don't know/have enough" alternative false-positiving on an unrelated aside inside an
// otherwise-complete plan; R6 found that same false-positive shape recurring on two *other*
// alternatives in the same regex ("still waiting"/"pending confirmation" mentioned as a trailing
// caveat, not the lede) — the anchoring fix from R5 had only been applied to one of five
// alternatives. The actual root cause R6 surfaced: scanning the *whole* reply/claim for any
// incompleteness-shaped phrase fights against Marcus's own prompt.md, which explicitly instructs
// him to name a real unverified detail *within* an otherwise-complete plan ("Time-box a real
// unknown instead of designing around a guess... say so plainly and name it as unverified") — the
// recorded fixture does exactly this, naming a specific thing he hasn't verified (what he has and
// hasn't read/confirmed) as a peripheral, non-blocking aside rather than a reason to stall. Stated
// qualitatively rather than as an exact quote — this scenario's own fixture has already been
// re-recorded multiple times across unrelated fixes elsewhere in this prompt (R8 below, and again
// at BUILD_PLAN 6.1c when Marcus's 8th scenario was added — this tool's recording script has no
// per-scenario filter, so adding any new scenario for a persona re-records every existing one for
// that persona too), and the model's exact wording is non-deterministic even for identical input —
// an exact quote here would go stale on the next re-record the same way it already has twice
// (distinct from `docs/REVIEW-PATTERNS.md`'s "Recorded-transcript drift," which is about a fixture
// silently outliving a prompt change; this is about *prose describing* a fixture's content
// outliving a re-record the staleness gate correctly required and nothing was actually wrong with).
// No amount of per-phrase topic-anchoring closes that:
// the discriminating signal was never "does the text ever mention uncertainty," it's "does the
// reply *open* with a stall instead of a plan" (the real stalling transcript's first sentence is
// "Not enough here to plan against yet"; the real plan's first sentence commits to an approach) —
// so this only scans the opening sentence, not the whole body. R7 found this still had two gaps:
// (a) with no ". "/blank-line anywhere, `split()[0]` silently returns the *entire* text, quietly
// reverting to the whole-body scan R6 already discredited — bounded to a fixed-length prefix
// instead, so "no sentence boundary found" degrades to "scan a bounded window," never the whole
// body; (b) dropping the claim-side check entirely (see the report_status assertion below) let a
// genuinely conditional "ready" claim through — a claim can name a real open item as a trailing
// detail on an otherwise-firm "ready" (fine, shouldn't fail) or make the readiness itself
// contingent on a future event ("ready once confirmed... before this is final" — not actually
// ready, should fail); `impliesConditionalReadiness` targets that second shape specifically,
// narrower than a full incompleteness scan. R8 (BUILD_PLAN 5.3g, a re-record triggered by an
// unrelated fix elsewhere in this prompt) found the report_status assertion had an unstated
// assumption baked in: that finishing a complete plan must always also emit a status claim
// through the tool. His own prompt.md's instruction is conditional ("if you want to tell someone
// a plan is... ready to hand off"), not a requirement — a real recording answered "plan it" with
// a complete plan and no report_status call at all, which the assertion then failed purely for
// lacking a tool call, not for anything actually wrong with the reply. Fixed by adding a no-call
// branch that passes as long as the free-prose reply doesn't itself assert an ungated "ready"
// claim outside the tool — the actual property this assertion exists to guard, per R7 above.
//
// Extracted to its own file at BUILD_PLAN 6.1g once `scenarios.ts` (already near the 300-line cap
// from this saga's own documented history) tipped over the limit adding the new
// `plain-acknowledgment-react-grounding` scenario — same logic, not a behavior change.
const OPENING_WINDOW_CHARS = 200;

export function opensWithIncompleteness(text: string): boolean {
  const [firstSentence] = text.split(/\.\s|\n\n/);
  const opening =
    firstSentence !== undefined && firstSentence.length < text.length
      ? firstSentence
      : text.slice(0, OPENING_WINDOW_CHARS);
  return /not enough (here|information|to plan|to ground)|don'?t (know|have) enough (here|information|to plan|to ground)|can'?t (plan|ground this)( yet)?|still (need|gathering|waiting)|pending (confirmation|an? answer)/.test(
    opening,
  );
}

function impliesConditionalReadiness(claim: string): boolean {
  return /\b(once|after|when)\s+(confirmed|finalized|riley'?s?\s+(answer|confirmation))\b|before (this|it) (is|'s) final|not yet final/.test(
    claim,
  );
}

// R8 (BUILD_PLAN 5.3g): extracted from the report_status assertion's own check callback purely to
// keep its cyclomatic complexity under the repo's lint threshold once the no-tool-call branch was
// added — same logic, not a behavior change.
export function isGenuineReadyClaim(claim: string): boolean {
  const negatedReady = /\b(not|isn'?t|wasn'?t)\s+(yet\s+)?ready\b/.test(claim);
  const unnegatedBlocked =
    /\bblocked\b/.test(claim) &&
    !/\b(not|isn'?t|wasn'?t)\s+blocked\b/.test(claim);
  return (
    /\bready\b/.test(claim) &&
    !negatedReady &&
    !unnegatedBlocked &&
    !impliesConditionalReadiness(claim)
  );
}
