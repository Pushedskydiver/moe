import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// docs/decisions/STAGE-1-CLASSIFIER.md's Decision 2 — the eval's own evidence, not a guess: Haiku
// separated genuine-work-signal messages (score >= 72) from non-actionable ones (score <= 35)
// with a clean, unoccupied 36-71 band, at a fraction of Sonnet 5's cost.
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;

// Freshly authored for this production call site — the ADR's own eval script was throwaway and
// never committed (BUILD_PLAN 3.1), so this isn't a copy of the original prompt, only informed by
// the ADR's Decision 3 finding: a real-but-low-priority complaint (its own "coffee machine is
// broken again" example) should score above pure banter, not get flattened to zero alongside it.
const CLASSIFIER_SYSTEM_PROMPT =
  'You are a fast triage classifier for a shared team Slack channel. Given a single message, on ' +
  'its own with no other context, decide how likely it is that the message describes something ' +
  'that needs work done — a bug report, a feature request, a task, a genuine facilities/ops ' +
  'issue, or a question that needs someone to act — versus general conversation, social chat, or ' +
  "commentary that doesn't need any action.\n\n" +
  'Respond with a confidence score from 0 to 100: 100 means you are certain this describes real ' +
  "work someone needs to act on; 0 means you are certain it's purely social with no actionable " +
  'content. Score by how likely the message is to need action, not by how important or urgent it ' +
  'sounds — a minor but real complaint (e.g. a broken office appliance) should still score above ' +
  'pure banter, even if it is low priority.\n\n' +
  'Also give a short one-sentence reasoning for your score, for human debugging only — it does ' +
  'not affect how the score is used downstream.';

const classificationSchema = z.object({
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string(),
});

export type MessageClassification = z.infer<typeof classificationSchema>;

const OUTPUT_FORMAT = zodOutputFormat(classificationSchema);

// Built on the real `Anthropic.MessageCreateParamsNonStreaming` shape (same approach as
// `generate-reply.ts`'s `GenerateReplyClient`), not a hand-rolled mirror — `messages` there is a
// mutable `MessageParam[]`, and a `readonly` mirror type is NOT assignable to it (verified: this
// broke `tsc` when first written with a `ReadonlyArray` field), so reusing the SDK's own type is
// both simpler and actually correct, not just stylistically consistent.
type ClassifyMessageConfidenceClient = {
  readonly messages: {
    readonly parse: (
      params: Anthropic.MessageCreateParamsNonStreaming & {
        readonly output_config: { readonly format: typeof OUTPUT_FORMAT };
      },
    ) => Promise<{
      readonly parsed_output: MessageClassification | null;
      readonly usage: {
        readonly input_tokens: number;
        readonly output_tokens: number;
      };
    }>;
  };
};

export type ClassifyMessageConfidenceParams = {
  readonly text: string;
};

export type ClassifyMessageConfidenceUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type ClassifyMessageConfidenceResult =
  | ({
      readonly ok: true;
      readonly usage: ClassifyMessageConfidenceUsage;
    } & MessageClassification)
  | {
      readonly ok: false;
      readonly error: {
        readonly kind:
          | 'anthropic-api-error'
          | 'invalid-classification-output'
          | 'no-parsed-output';
        readonly message: string;
      };
    };

/**
 * VISION §5.2's Stage 1 gate, per `docs/decisions/STAGE-1-CLASSIFIER.md`: one bundled structured-
 * output call, Claude Haiku 4.5, a single 0-100 integer confidence score. Uses `zodOutputFormat` +
 * `.parse()` (not raw `.create()` + manual `JSON.parse`) so the response is validated against the
 * same Zod schema this function's own return type is built from — matching CLAUDE.md's "full Zod
 * v4 for all runtime validation" constraint, not a workaround. `usage` passes through the API
 * response's own token counts, same "stateless, reports usage rather than accounting for it"
 * precedent as `generateReply` — the real call site (`apps/server/src/handle-inbound-message.ts`)
 * turns this into a cost-cap check before the call and a persisted cost record after it, exactly
 * like the DM reply path already does (BUILD_PLAN 2.6a/2.6b) — a real, billed Anthropic call needs
 * the same gate and accounting regardless of which model or call site it's on.
 *
 * Three distinct failure kinds, verified against the installed SDK's actual source (not assumed):
 * a genuine request-level failure (rate limit, timeout, auth) throws an `APIError` — bucketed as
 * `anthropic-api-error`. `zodOutputFormat`'s own `.parse()` throws a bare `AnthropicError` (not an
 * `APIError`) when the model's raw text isn't valid JSON or fails the Zod schema (a refusal,
 * `max_tokens`-truncated output, or an out-of-range score realistically land here, not as
 * `parsed_output: null`) — bucketed separately as `invalid-classification-output`, so a caller (or
 * future monitoring against the ADR's own "Triggers for re-evaluation") can tell "the API call
 * failed" apart from "the model's output didn't conform to the schema." `parsed_output` itself
 * coming back `null` is the SDK's own fallback for a response with no text content block at all —
 * a rare edge case, not the refusal/non-`end_turn` case an earlier draft of this comment claimed.
 */
// Extracted purely to stay under `max-lines-per-function` — same "composition code extracts
// aggressively" precedent as `apps/server/src/start-slack-listener.ts`'s `createStores`.
// Discriminates by class, not by message content: `APIError` (rate limit, timeout, auth — all its
// subclasses) is a genuine request-level failure; a bare `AnthropicError` that isn't an `APIError`
// is `zodOutputFormat`'s own thrown parse/validation failure (see the TSDoc above this function).
function toClassifyMessageConfidenceError(
  error: unknown,
): Extract<ClassifyMessageConfidenceResult, { readonly ok: false }> {
  if (error instanceof APIError) {
    return {
      ok: false,
      error: { kind: 'anthropic-api-error', message: error.message },
    };
  }
  if (error instanceof AnthropicError) {
    return {
      ok: false,
      error: { kind: 'invalid-classification-output', message: error.message },
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

export async function classifyMessageConfidence(
  client: ClassifyMessageConfidenceClient,
  params: ClassifyMessageConfidenceParams,
): Promise<ClassifyMessageConfidenceResult> {
  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: params.text }],
      output_config: { format: OUTPUT_FORMAT },
    });

    if (message.parsed_output === null) {
      return {
        ok: false,
        error: {
          kind: 'no-parsed-output',
          message: 'classifier response had no parsed_output',
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
    return toClassifyMessageConfidenceError(error);
  }
}
