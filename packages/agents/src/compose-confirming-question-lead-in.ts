import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { buildCachedSystemBlocks } from './build-cached-system-blocks.js';

// claude-sonnet-5 is VISION §10/§11's resolved "Sonnet-by-default" model — same choice
// `composeTicketDraft` makes for the identical reason (a compositional writing task, not the
// cheap high-volume classification gate Haiku is used for).
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 256;

// BUILD_PLAN 5.3a-ii's Mid-band confirming-question conversion. The model composes only the
// "why this looked like work" framing, in the persona's own voice — never the reaction mechanic
// itself. Deliberate split (see `apps/server/src/compose-and-post-confirming-question.ts`'s own
// TSDoc for the full reasoning): a fixed, code-controlled trailer naming the literal 👍/👎
// mechanic is appended by the caller, so the interactive affordance can never drift out of sync
// with model phrasing variance.
//
// DA review flagged an unaddressed tension worth naming here: Sarah's own `prompt.md` (do-not-touch
// — this file can't edit it, only work around it) says "lead with the question itself, not a runup
// to it" for confirming questions in general. This specific call site is a deliberate, narrower
// exception to that general preference, called out explicitly below rather than left for the model
// to reconcile silently — live-tested across both this project's own adversarial-validation rounds
// with no observed defect, but worth Alex's awareness as a known, currently-inert edge of the
// do-not-touch/new-instruction boundary.
const TASK_INSTRUCTION =
  'You are about to post a short confirming question to a Slack channel or DM, about a single ' +
  'message that a separate, already-run classifier flagged as possibly-but-not-certainly real ' +
  'work — you are not re-deciding whether it is work, only framing why it looked that way. This ' +
  'specific interaction is structured framing-first: a fixed trailer sentence naming the literal ' +
  'reaction mechanic is appended after your text by the caller, so the actual question/call-to-action ' +
  'always comes last, code-controlled — a deliberate exception here to your own general instinct to ' +
  "lead with the question itself. Given the message and the classifier's own confidence/reasoning, " +
  'write a one-to-two-sentence lead-in, in your own voice, naming the specific thing about the ' +
  "message that made this uncertain. Do not invent detail the message doesn't state. Don't restate " +
  'or invent your own call-to-action; end right where your framing ends.';

const leadInSchema = z.object({ questionLeadIn: z.string().min(1) });

export type ConfirmingQuestionLeadIn = z.infer<typeof leadInSchema>;

const OUTPUT_FORMAT = zodOutputFormat(leadInSchema);

// Same "reuse the real Anthropic.MessageCreateParamsNonStreaming shape" approach as
// `compose-ticket-draft.ts`'s own client type, for the same reason. `usage`'s two cache fields
// are `number | null`, always present, matching the real SDK's `Usage` shape (BUILD_PLAN 5.3a-ii
// — this call site sets `cache_control` from the start, so there's no window where it could ship
// without the widened type, unlike `composeTicketDraft`'s own PR which retrofitted it).
type ComposeConfirmingQuestionLeadInClient = {
  readonly messages: {
    readonly parse: (
      params: Anthropic.MessageCreateParamsNonStreaming & {
        readonly output_config: { readonly format: typeof OUTPUT_FORMAT };
      },
    ) => Promise<{
      readonly parsed_output: ConfirmingQuestionLeadIn | null;
      readonly usage: {
        readonly input_tokens: number;
        readonly output_tokens: number;
        readonly cache_creation_input_tokens: number | null;
        readonly cache_read_input_tokens: number | null;
      };
    }>;
  };
};

export type ComposeConfirmingQuestionLeadInParams = {
  readonly text: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly model?: string;
  // Already-resolved value, not a `personaId` — mirrors `composeTicketDraft`'s own
  // `personaPromptContent` param shape exactly.
  readonly personaPromptContent?: string;
};

export type ComposeConfirmingQuestionLeadInUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens?: number;
  readonly cacheReadInputTokens?: number;
};

export type ComposeConfirmingQuestionLeadInResult =
  | {
      readonly ok: true;
      readonly questionLeadIn: string;
      readonly usage: ComposeConfirmingQuestionLeadInUsage;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind:
          'anthropic-api-error' | 'invalid-lead-in-output' | 'no-parsed-output';
        readonly message: string;
      };
    };

// Extracted purely to stay under `max-lines-per-function`, same precedent and same
// APIError-before-AnthropicError discrimination as `compose-ticket-draft.ts`'s own
// `toComposeTicketDraftError`.
function toComposeConfirmingQuestionLeadInError(
  error: unknown,
): Extract<ComposeConfirmingQuestionLeadInResult, { readonly ok: false }> {
  if (error instanceof APIError) {
    return {
      ok: false,
      error: { kind: 'anthropic-api-error', message: error.message },
    };
  }
  if (error instanceof AnthropicError) {
    return {
      ok: false,
      error: { kind: 'invalid-lead-in-output', message: error.message },
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

// The message text is the exact, unquoted tail of the turn — nothing follows it. DA review
// live-reproduced a real failure in an earlier `Message: "${text}"`-wrapped version: a message
// combining a quote with field-label-shaped content (e.g. mimicking "Classifier confidence: ...")
// reliably broke the model's own structured-JSON output, since the literal `"..."` wrapping gave
// untrusted text a closing delimiter to spoof. Putting the labeled fields first and the raw
// message last, with no delimiter after it to escape removes *that specific* spoofable boundary —
// `composeTicketDraft.ts`'s own precedent (`content: params.text`, no wrapping at all) is the
// same underlying idea, adapted here since this call site also needs to carry confidence/reasoning
// in the same turn. **Does not fully close the risk** (R2 review, confirmed by two independent
// live-testing rounds): the exact adversarial combination above — quote plus fake field-label
// content together — still fails near-100% of the time even with this construction, most likely a
// deeper model-side JSON-escaping limit rather than something further prompt-construction changes
// can fix. Bounded either way: a failure here is caught by the `try`/`catch` below and treated
// exactly like any other compose failure by the caller, falling back to the safe fixed template —
// but the failure is fully deterministic on a describable, not-purely-adversarial input shape (an
// ordinary paste containing literal "confidence:"/"reasoning:"-labeled text would trigger it too)
// and produces no Slack-visible signal, only a logged error — flagged for Alex's own awareness,
// not something to treat as silently resolved.
function buildUserTurn(params: ComposeConfirmingQuestionLeadInParams): string {
  return (
    `Classifier confidence: ${params.confidence}/100\n` +
    `Classifier reasoning: ${params.reasoning}\n\n` +
    'Message (verbatim, exactly as sent — everything from here to the end of this turn):\n' +
    params.text
  );
}

/**
 * BUILD_PLAN 5.3a-ii's Mid-band confirming-question conversion — composes only the persona-voiced
 * lead-in sentence(s); the caller (`apps/server/src/compose-and-post-confirming-question.ts`)
 * appends the fixed reaction-mechanic trailer and falls back to the pre-5.3a-ii fixed template on
 * any `ok: false` result, mirroring `generateAndPost`'s own "never regress below a safe fixed
 * default" shape. `params.model` defaults to `DEFAULT_MODEL` when omitted; the real call site
 * always overrides it with `resolvePersonaModel(deps.personaId)` (BUILD_PLAN 5.3a).
 * `params.personaPromptContent`, when given, prefixes the persona's own voice ahead of
 * `TASK_INSTRUCTION` — mirrors `composeTicketDraft`'s own combination shape exactly. `usage`'s two
 * cache fields are populated whenever the response actually cached anything;
 * `sonnetCostUsdMicros` prices them the same way it already does for the other two cascade call
 * sites.
 */
export async function composeConfirmingQuestionLeadIn(
  client: ComposeConfirmingQuestionLeadInClient,
  params: ComposeConfirmingQuestionLeadInParams,
): Promise<ComposeConfirmingQuestionLeadInResult> {
  try {
    const message = await client.messages.parse({
      model: params.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // Persona voice first (cacheable-if-large), task instructions last — same ordering
      // rationale as `composeTicketDraft`'s own `system` construction.
      system: [
        ...buildCachedSystemBlocks([
          params.personaPromptContent,
          TASK_INSTRUCTION,
        ]),
      ],
      messages: [{ role: 'user', content: buildUserTurn(params) }],
      output_config: { format: OUTPUT_FORMAT },
    });

    if (message.parsed_output === null) {
      return {
        ok: false,
        error: {
          kind: 'no-parsed-output',
          message: 'confirming-question lead-in response had no parsed_output',
        },
      };
    }

    return {
      ok: true,
      questionLeadIn: message.parsed_output.questionLeadIn,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheCreationInputTokens:
          message.usage.cache_creation_input_tokens ?? undefined,
        cacheReadInputTokens:
          message.usage.cache_read_input_tokens ?? undefined,
      },
    };
  } catch (error) {
    return toComposeConfirmingQuestionLeadInError(error);
  }
}
