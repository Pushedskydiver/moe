import type { Anthropic } from '@anthropic-ai/sdk';

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// docs/decisions/STAGE-1-CLASSIFIER.md's Decision 2 — the eval's own evidence, not a guess: Haiku
// separated genuine-work-signal messages (score >= 72) from non-actionable ones (score <= 35)
// with a clean, unoccupied 36-70 band, at a fraction of Sonnet 5's cost.
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;

// Freshly authored for this production call site — the ADR's own eval script was throwaway and
// never committed (BUILD_PLAN 3.1), so this isn't a copy of the original prompt, only informed by
// the ADR's Decision 4 finding: a real-but-low-priority complaint (its own "coffee machine is
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
    ) => Promise<{ readonly parsed_output: MessageClassification | null }>;
  };
};

export type ClassifyMessageConfidenceParams = {
  readonly text: string;
};

export type ClassifyMessageConfidenceResult =
  | ({ readonly ok: true } & MessageClassification)
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'anthropic-api-error' | 'no-parsed-output';
        readonly message: string;
      };
    };

/**
 * VISION §5.2's Stage 1 gate, per `docs/decisions/STAGE-1-CLASSIFIER.md`: one bundled structured-
 * output call, Claude Haiku 4.5, a single 0-100 integer confidence score. Uses `zodOutputFormat` +
 * `.parse()` (not raw `.create()` + manual `JSON.parse`) so the response is validated against the
 * same Zod schema this function's own return type is built from — matching CLAUDE.md's "full Zod
 * v4 for all runtime validation" constraint, not a workaround. `parsed_output` coming back `null`
 * (the SDK's own documented possibility, e.g. a refusal or a non-`end_turn` stop) is a distinct
 * error kind from a request-level failure, same "expected failure gets its own kind" shape as
 * `generateReply`'s `no-content`.
 */
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

    return { ok: true, ...message.parsed_output };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'anthropic-api-error',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
