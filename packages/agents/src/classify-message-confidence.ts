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
//
// BUILD_PLAN 3.12 (2026-08-01): the original "or a question that needs someone to act" clause was
// wide enough to also catch a question asking about the *progress* of already-known work ("is the
// auth work finished?") — Haiku scored it 75 and it auto-drafted a ticket whose entire body was
// "someone asked whether the auth work is finished." The replacement below narrows that one clause
// to "asking whether an already-identified piece of work is finished, done, or has happened yet" —
// deliberately not "a status/informational question" more broadly, which a first attempt at this
// wording tried and which pulled a genuine resource-existence gap ("do we have a billing docs
// page anywhere," the ADR's own ambiguous-cluster example) down from Mid to Low, silently
// deleting its only path to becoming a tracked ticket (the Low-band conversational reply has no
// ticket-creation tool, only `report_status`). The explicit carve-out for existence/lookup
// questions in the first paragraph below is what keeps that case in its original band. Live-
// evaluated against the real API (see the ADR's Addendum, 2026-08-01) — status-question variants
// dropped from 42-75 into Low. One further, deliberate side effect: a mixed status-question+
// request case moved High to Mid (the ADR's own addendum names why). Every other evaluated row
// moved at most 15 points and stayed within its original High/Mid/Low band — see the addendum's
// own score table for the real per-row deltas rather than treating any row as untouched.
const CLASSIFIER_SYSTEM_PROMPT =
  'You are a fast triage classifier for a shared team Slack channel. Given a single message, on ' +
  'its own with no other context, decide how likely it is that the message describes something ' +
  'that needs new work done — a bug report, a feature request, a task, a genuine facilities/ops ' +
  'issue, a request for someone to look into or handle something (even if phrased as a ' +
  'question), or a question asking whether some resource or thing exists ("do we have a billing ' +
  'docs page?", "is there a shared style guide?") — versus general conversation, social chat, ' +
  "commentary that doesn't need any action, or a question asking whether an already-identified " +
  'piece of work is finished, done, or has happened yet.\n\n' +
  'A request phrased as a question ("can someone look at the deploy?", "could someone fix the ' +
  'login bug?") is still a work signal — nobody has acted on it yet. So is a question asking ' +
  'whether some resource or thing exists — if the answer turns out to be no, that is itself worth ' +
  'tracking, so score it like any other work-adjacent message on its own merits, not ' +
  'specially demoted.\n\n' +
  'A question asking whether an already-identified piece of work is *finished, done, or has ' +
  'happened yet* ("is the auth work finished?", "did the deploy go out ok?", "did the migration ' +
  'run yet?", "what\'s the status of the login bug?") is NOT a work signal on its own, even ' +
  "though it's a question someone needs to answer — answering it is a reply about progress on " +
  "something already underway, not a new task, and it doesn't need a ticket. If a message both " +
  'asks about progress AND asks for new action ("is the auth work finished? if not can someone ' +
  'wrap it up today"), treat the new-action half as the work signal.\n\n' +
  'Respond with a confidence score from 0 to 100: 100 means you are certain this describes real ' +
  "work someone needs to act on; 0 means you are certain it's purely social or purely about the " +
  'progress of something already underway, with no actionable content of its own. Score by how ' +
  'likely the message is to need action, not by how important or urgent it sounds — a minor but ' +
  'real complaint (e.g. a broken office appliance) should still score above pure banter, even if ' +
  'it is low priority.\n\n' +
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
