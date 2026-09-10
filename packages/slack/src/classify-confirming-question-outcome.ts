export type ConfirmingQuestionOutcome = 'yes' | 'no';

// BUILD_PLAN 6.1e's own live-fleet check found this empirically, against a real captured
// `reaction_added` event from Marcus's real Slack app: a genuine 👍 click in the Slack UI reports
// `"reaction": "+1"`, not `"thumbsup"`. **Corrected 2026-09-10** — BUILD_PLAN 3.4b-i's original
// comment here claimed the opposite ("Slack's own published event reference... its own example
// payload literally shows `"reaction": "thumbsup"`") and rejected `iamcal/emoji-data`'s
// primary/alias split (`+1`/`-1`) as "the wrong answer." That claim was itself wrong — `+1`/`-1`
// is what a real human reaction actually produces; `thumbsup`/`thumbsdown` are kept as accepted
// aliases too (harmless to accept both, and some other `reactions.add` call passing the literal
// alias name, or a different Slack client, could plausibly still send it) rather than replaced
// outright, since nothing here rules that out with the same confidence the `+1`/`-1` finding has.
// A `Map`, not a plain object literal — same reasoning `classify-reaction-outcome.ts`'s own
// `OUTCOME_BY_REACTION_NAME` documents: `reactionName` is an external, attacker-influenceable
// string (a Slack *custom* workspace emoji can be named almost anything, including
// `constructor`/`__proto__`/`toString`), and `Map.get()` has no prototype-chain fallback the way a
// plain `{}` lookup does.
const OUTCOME_BY_REACTION_NAME = new Map<string, ConfirmingQuestionOutcome>([
  ['+1', 'yes'],
  ['-1', 'no'],
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
