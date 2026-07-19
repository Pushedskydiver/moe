import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// Same cheap-classifier cost profile as `classify-message-confidence.ts` — this is a binary
// safety check, not a compositional writing task, so Haiku 4.5 over Sonnet 5.
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;

// BUILD_PLAN 3.4a-iii's "minimal situational-appropriateness gate" (VISION §9) — Alex confirmed
// via `AskUserQuestion`, not inferred: an LLM content classifier reading the specific message,
// not a keyword list or an external on/off toggle, since the failure mode it exists to prevent
// (VISION §9's Viktor illustration — reacting to a layoff announcement with a skull emoji) is
// about message *content*, not timing or a fixed vocabulary a genuinely sensitive message might
// not even use. This is a distinct axis from Stage 1's `classifyMessageConfidence` (is this
// actionable work?) — a message can be both clearly actionable AND situationally inappropriate to
// auto-post about right now (a real incident is "work," but announcing it via an auto-drafted
// ticket the moment it's reported may not be the right first response).
const APPROPRIATENESS_SYSTEM_PROMPT =
  'You are a safety check for an AI teammate that is about to auto-post a work-ticket draft in ' +
  'response to a Slack message. Given a single message, decide whether auto-posting a ticket ' +
  'draft right now would be situationally inappropriate — for example, the message describes a ' +
  'layoff, a death, a serious personal or interpersonal crisis, grief, a major conflict, or ' +
  'another emotionally weighty human situation where an automated, matter-of-fact response ' +
  'would land badly, even if the message also happens to describe something actionable.\n\n' +
  'Respond `appropriate: true` for the ordinary case — routine bug reports, feature requests, ' +
  'ops/facilities issues, questions, and everyday work chatter should all be `true`. Respond ' +
  '`appropriate: false` only when the message itself reads as a serious or sensitive human ' +
  'situation, not merely because it sounds urgent or high-severity as a technical matter.\n\n' +
  'Also give a short one-sentence reasoning for your decision, for human debugging only — it ' +
  'does not affect how the decision is used downstream.';

const appropriatenessSchema = z.object({
  appropriate: z.boolean(),
  reasoning: z.string(),
});

export type SituationalAppropriateness = z.infer<typeof appropriatenessSchema>;

const OUTPUT_FORMAT = zodOutputFormat(appropriatenessSchema);

// Same "reuse the real Anthropic.MessageCreateParamsNonStreaming shape" approach as
// `classify-message-confidence.ts`'s client type, for the same reason: a hand-rolled `readonly`
// mirror of `messages` isn't assignable to the SDK's own mutable `MessageParam[]`.
type EvaluateSituationalAppropriatenessClient = {
  readonly messages: {
    readonly parse: (
      params: Anthropic.MessageCreateParamsNonStreaming & {
        readonly output_config: { readonly format: typeof OUTPUT_FORMAT };
      },
    ) => Promise<{
      readonly parsed_output: SituationalAppropriateness | null;
      readonly usage: {
        readonly input_tokens: number;
        readonly output_tokens: number;
      };
    }>;
  };
};

export type EvaluateSituationalAppropriatenessParams = {
  readonly text: string;
};

export type EvaluateSituationalAppropriatenessUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type EvaluateSituationalAppropriatenessResult =
  | ({
      readonly ok: true;
      readonly usage: EvaluateSituationalAppropriatenessUsage;
    } & SituationalAppropriateness)
  | {
      readonly ok: false;
      readonly error: {
        readonly kind:
          | 'anthropic-api-error'
          | 'invalid-appropriateness-output'
          | 'no-parsed-output';
        readonly message: string;
      };
    };

// Extracted purely to stay under `max-lines-per-function`, same precedent and same discrimination
// logic as `classify-message-confidence.ts`'s `toClassifyMessageConfidenceError` — `APIError`
// (request-level failures) must be checked before the more general `AnthropicError` it extends.
function toEvaluateSituationalAppropriatenessError(
  error: unknown,
): Extract<EvaluateSituationalAppropriatenessResult, { readonly ok: false }> {
  if (error instanceof APIError) {
    return {
      ok: false,
      error: { kind: 'anthropic-api-error', message: error.message },
    };
  }
  if (error instanceof AnthropicError) {
    return {
      ok: false,
      error: {
        kind: 'invalid-appropriateness-output',
        message: error.message,
      },
    };
  }
  return {
    ok: false,
    error: {
      kind: 'anthropic-api-error',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

/**
 * BUILD_PLAN 3.4a-iii's situational-appropriateness gate (VISION §9) — consulted before
 * `composeAndPostDraft`'s real Slack post (specifically its `isSituationallyAppropriate` step), not
 * before the Stage 1 classifier or the reaction-outcome dispatch (Alex confirmed via
 * `AskUserQuestion`: only the unprompted, standing-proactive draft-post needs this check —
 * responding to a human's own ✅/🔁/📦 reaction is reactive, not the bot acting unprompted, same
 * "reactive vs proactive" distinction 2.7a's core-hours guard already draws for DM replies).
 *
 * **Fails CLOSED, not open** — the opposite of `checkCostCapAndAlert`'s own fail-open design. A
 * cost-cap DB blip is unrelated to real spend risk, so failing open there just means "keep
 * replying while temporarily unable to check a number." A failure *here* (rate limit, timeout, a
 * malformed response) means this call genuinely cannot tell whether the message is safe to
 * auto-post about — and VISION §14's own "better to wrongly rest once than wrongly act on an
 * actual holiday" reasoning for 2.7a's bank-holiday guard applies with equal force to this gate:
 * an uncertain safety signal should block the risky action, not wave it through. The caller
 * treats any `ok: false` result the same way as `appropriate: false`.
 */
export async function evaluateSituationalAppropriateness(
  client: EvaluateSituationalAppropriatenessClient,
  params: EvaluateSituationalAppropriatenessParams,
): Promise<EvaluateSituationalAppropriatenessResult> {
  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: APPROPRIATENESS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: params.text }],
      output_config: { format: OUTPUT_FORMAT },
    });

    if (message.parsed_output === null) {
      return {
        ok: false,
        error: {
          kind: 'no-parsed-output',
          message: 'situational-appropriateness response had no parsed_output',
        },
      };
    }

    return {
      ok: true,
      ...message.parsed_output,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  } catch (error) {
    return toEvaluateSituationalAppropriatenessError(error);
  }
}
