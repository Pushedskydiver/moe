// claude-sonnet-5 pricing (`docs/VISION.md` §10, verified against Anthropic's own pricing page):
// introductory $2/$10 per MTok (input/output) runs through 2026-08-31, then $3/$15 standard. 1 USD
// per MTok is numerically identical to 1 micro-USD per token (1,000,000 micros / 1,000,000
// tokens/MTok) — the "MicrosPerToken" constants below are the same figures VISION cites, not a
// separately-derived unit conversion. Scoped to the one hardcoded model `generate-reply.ts` uses
// today (BUILD_PLAN 2.6a) — "per-persona model tuning as real data comes in" (VISION §10) is
// out of scope until a second model is actually wired in.
const CUTOVER_UTC_MS = Date.parse('2026-09-01T00:00:00.000Z');
const INTRODUCTORY_PRICING = {
  inputMicrosPerToken: 2,
  outputMicrosPerToken: 10,
};
const STANDARD_PRICING = { inputMicrosPerToken: 3, outputMicrosPerToken: 15 };

/**
 * Converts one turn's token usage into its cost in micro-USD (USD × 1,000,000 — see
 * `@moe/core`'s `personaCostUsageSchema` doc comment for why), selecting introductory vs.
 * standard Sonnet-5 pricing by `now`, not by when this function happens to run — so a turn
 * accounted for after the cutover with a `now` from before it still prices correctly.
 */
export function computeCostUsdMicros(
  usage: { readonly inputTokens: number; readonly outputTokens: number },
  now: Date,
): number {
  const pricing =
    now.getTime() < CUTOVER_UTC_MS ? INTRODUCTORY_PRICING : STANDARD_PRICING;

  return (
    usage.inputTokens * pricing.inputMicrosPerToken +
    usage.outputTokens * pricing.outputMicrosPerToken
  );
}
