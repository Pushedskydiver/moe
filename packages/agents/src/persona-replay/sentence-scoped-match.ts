/**
 * Extracted to `persona-replay/` once a third persona's `scenarios.ts` needed the identical
 * helper (`docs/CONVENTIONS.md` §`shared/` discipline's 2+-sibling-consumer trigger) — Riley's,
 * Marcus's, and Theo's own inline negation-guard checks had converged on the same shape.
 *
 * Checks whether `positiveRe` matches within some sentence of `text` that `negationRe` does NOT
 * also match — a genuine, ungated claim rather than one hedged in the same breath. Scoping to the
 * sentence, not the whole reply, closes both directions of the same failure: an unrelated hedge
 * elsewhere in the reply can no longer mask a real unhedged claim (a whole-reply negation check
 * would wrongly treat "Confirmed fixed. Also, I haven't verified the timing separately." as
 * hedged), and a hedge landing in the same sentence as the claim it qualifies is correctly not
 * treated as an ungated claim ("yes, that's what Marcus said, but I haven't verified it myself"
 * opens with a positive-shaped word without actually asserting it). This is the same
 * "whole-body scan vs. an unrelated aside" failure shape
 * `packages/agents/src/personas/marcus/replay/scenarios.ts`'s own multi-round history already
 * named and fixed for its opening-window incompleteness check — applied here generically instead
 * of once more per call site.
 */
export function hasSentenceScopedMatch(
  text: string,
  positiveRe: RegExp,
  negationRe: RegExp,
): boolean {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.some(
    (sentence) => positiveRe.test(sentence) && !negationRe.test(sentence),
  );
}
