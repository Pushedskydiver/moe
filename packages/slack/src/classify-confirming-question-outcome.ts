export type ConfirmingQuestionOutcome = 'yes' | 'no';

// 👍/👎 short-names verified against Slack's own published `reaction_added` event reference
// (BUILD_PLAN 3.4b-i — its own example payload literally shows `"reaction": "thumbsup"`), not
// guessed from `iamcal/emoji-data`'s primary/alias field split, which would have given the wrong
// answer (`+1`/`-1`) here. A `Map`, not a plain object literal — same reasoning
// `classify-reaction-outcome.ts`'s own `OUTCOME_BY_REACTION_NAME` documents: `reactionName` is an
// external, attacker-influenceable string (a Slack *custom* workspace emoji can be named almost
// anything, including `constructor`/`__proto__`/`toString`), and `Map.get()` has no
// prototype-chain fallback the way a plain `{}` lookup does.
const OUTCOME_BY_REACTION_NAME = new Map<string, ConfirmingQuestionOutcome>([
  ['thumbsup', 'yes'],
  ['thumbsdown', 'no'],
]);

/**
 * Maps a Slack reaction's short-name to the Mid-band confirming-question answer it represents
 * (BUILD_PLAN 3.4b-ii) — `undefined` for any reaction outside the 👍/👎 legend, which callers
 * should ignore rather than treat as an error, same as `classifyReactionOutcome`'s own contract.
 */
export function classifyConfirmingQuestionOutcome(
  reactionName: string,
): ConfirmingQuestionOutcome | undefined {
  return OUTCOME_BY_REACTION_NAME.get(reactionName);
}
