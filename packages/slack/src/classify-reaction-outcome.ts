export type ReactionOutcome = 'commit' | 'redo' | 'park';

// Slack short-names verified against the real `iamcal/emoji-data` database (2026-07-18), not
// guessed — same discipline BUILD_PLAN 2.7b's away-detection keywords used, and the same class of
// gotcha it already caught once: 🔁 is `repeat`, not the more obvious-sounding
// `arrows_counterclockwise`. A `Map`, not a plain object literal — `reactionName` is an external,
// attacker-influenceable string (a Slack *custom* workspace emoji can be named almost anything,
// including `constructor`/`__proto__`/`toString`), and a plain `{}` lookup answers those with a
// truthy `Object.prototype` member instead of `undefined` (DA review, chunk 3.4a-ii — confirmed
// live that `{}['constructor']` returns the `Object` function, which `handleReactionAdded`'s
// dispatch would then treat as a real 🔁 redo, burning a billed Anthropic call on reactions outside
// the legend entirely). `Map.get()` has no such prototype-chain fallback.
const OUTCOME_BY_REACTION_NAME = new Map<string, ReactionOutcome>([
  ['white_check_mark', 'commit'],
  ['repeat', 'redo'],
  ['package', 'park'],
]);

/**
 * Maps a Slack reaction's short-name (the `reaction` field on a `reaction_added` event, colon-free)
 * to the VISION §5.2 reaction-gate outcome it represents — BUILD_PLAN 3.4a-ii's short-name mapping.
 * `undefined` for any reaction outside the 📦/🔁/✅ legend, which callers should ignore rather than
 * treat as an error — a persona's own channels see plenty of reactions this gate has no opinion on.
 */
export function classifyReactionOutcome(
  reactionName: string,
): ReactionOutcome | undefined {
  return OUTCOME_BY_REACTION_NAME.get(reactionName);
}
