import type {
  CostAndRhythmGuardDecision,
  SituationalAppropriatenessGuardDecision,
} from './standing-proactive-guards.js';

// Extracted from `handle-ambient-channel-message.ts`/`compose-and-post-confirming-question.ts`
// (BUILD_PLAN 3.10, DA review) once both High- and Mid-band callers needed the identical mapping
// logic — a genuine 2+-consumer case, not premature abstraction, the same bar every other shared
// extraction in this directory (`standing-proactive-guards.ts`, `log-ambient-intake-to-review-queue.ts`)
// already met.

// Exhaustive `switch`, not a ternary — `CostAndRhythmGuardDecision`'s own `reason` union is the
// single source of truth for which blocking reasons exist, so a hypothetical third one fails this
// function to *compile* (a missing `case` with no `default` leaves a code path with no `return`)
// rather than silently mislabeling itself under whatever a ternary's `: else` branch happened to
// spell. Mirrors `review-queue-sweep.ts`'s own exhaustive `SECTION_LABEL_BY_OUTCOME_REASON` Record
// for the identical enum-completeness goal. `evaluate*` per `docs/CONVENTIONS.md`'s verb
// vocabulary, not `resolve*`: this has no fallback/lookup chain (every input reaches a real `case`,
// nothing falls back to a default), which is exactly the line that doc draws between the two verbs.
export function evaluateHighBandCostAndRhythmOutcomeReason(
  reason: Exclude<CostAndRhythmGuardDecision['reason'], 'satisfied'>,
): 'high-band-cost-cap' | 'high-band-off-hours' {
  switch (reason) {
    case 'cost-cap-reached':
      return 'high-band-cost-cap';
    case 'outside-core-hours':
      return 'high-band-off-hours';
  }
}

// Mid-band sibling of the above — same reasoning, different labels (`'mid-band-off-hours'` etc.,
// see `logAmbientIntakeToReviewQueue`'s own TSDoc for why each band gets a distinct value).
export function evaluateMidBandCostAndRhythmOutcomeReason(
  reason: Exclude<CostAndRhythmGuardDecision['reason'], 'satisfied'>,
): 'mid-band-cost-cap' | 'mid-band-off-hours' {
  switch (reason) {
    case 'cost-cap-reached':
      return 'mid-band-cost-cap';
    case 'outside-core-hours':
      return 'mid-band-off-hours';
  }
}

// Band-agnostic, unlike the two mappings above — whether to log at all does not depend on which
// band called it, only the specific `outcomeReason` string the caller picks for a `true` result
// does. Unlike the cost-and-rhythm mapping, there is no safe universal default here — an infra
// blip should log, a considered `appropriate: false` verdict should not (BUILD_PLAN 3.10, Alex's
// own settled design question) — so this stays an exhaustive `switch` over whether to log at all,
// not a bare `=== 'evaluation-failed'`/`!== 'inappropriate'` check. Don't "simplify" this to the
// inequality spelling: it reads like the cost-and-rhythm guard's own fail-safe pattern above, but
// would silently violate the settled design by logging every future third reason by default
// instead of forcing a real decision for it here.
export function shouldLogAppropriatenessFailure(
  reason: Exclude<
    SituationalAppropriatenessGuardDecision['reason'],
    'satisfied'
  >,
): boolean {
  switch (reason) {
    case 'evaluation-failed':
      return true;
    case 'inappropriate':
      return false;
  }
}
