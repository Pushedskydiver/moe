import type { EvalModel } from './eval-configurations.js';

import { haikuCostUsdMicros } from '../model-pricing.js';

// claude-haiku-5-5: $0.10 input and $0.50 output per MTok (BUILD_PLAN 3.13), its rate for a
// prompt of 100K tokens or fewer, which every eval prompt is (above that, $0.50 and $2.50). 1 USD
// per MTok is 1 micro-USD per token, so these are fractional micros per token — the eval keeps
// them as floats rather than rounding each call, since a single call costs only about a hundred
// micros.
const HAIKU_5_5_PRICING = {
  inputMicrosPerToken: 0.1,
  outputMicrosPerToken: 0.5,
};

/**
 * One call's cost in micro-USD. Haiku 4.5 is priced by production's own `haikuCostUsdMicros`
 * (its `HAIKU_PRICING`, $1 and $5), so the eval's baseline column can't drift from what
 * production accounts; Haiku 5.5 at the prices above. Thinking tokens are inside
 * `outputTokens` (the API's `output_tokens` is the billed total), so they're priced as output.
 */
export function evalCostUsdMicros(
  model: EvalModel,
  usage: { readonly inputTokens: number; readonly outputTokens: number },
): number {
  if (model === 'claude-haiku-4-5') return haikuCostUsdMicros(usage);

  return (
    usage.inputTokens * HAIKU_5_5_PRICING.inputMicrosPerToken +
    usage.outputTokens * HAIKU_5_5_PRICING.outputMicrosPerToken
  );
}
