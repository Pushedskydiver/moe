import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// claude-sonnet-5 is VISION §10/§11's resolved "Sonnet-by-default" model — this is a compositional
// writing task (matching `generateReply`'s own use), not the cheap, high-volume classification
// gate `classify-message-confidence.ts` uses Haiku 4.5 for.
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 512;

// BUILD_PLAN's Stage 3 exit criterion: "at this stage ... a link-only draft (the URL plus whatever
// the message said)" — no enrichment, no invented detail, since Stage 3 has no GitHub client to
// fetch real issue content from a URL yet (that's chunk 4.1/4.4b). The prompt is written to keep
// the model from fabricating specifics the source message never stated.
const DRAFT_SYSTEM_PROMPT =
  'You compose a short work-ticket draft from a single Slack message that has already been ' +
  'identified as describing real work. Produce a concise title (a few words, like a git commit ' +
  'subject — no punctuation at the end) and a body (one to three sentences) that restates the ' +
  "message's own content plainly. Do not invent details, causes, or context the message doesn't " +
  'state — if the message is vague, keep the draft equally vague rather than guessing.';

const ticketDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export type TicketDraft = z.infer<typeof ticketDraftSchema>;

const OUTPUT_FORMAT = zodOutputFormat(ticketDraftSchema);

// Same "reuse the real Anthropic.MessageCreateParamsNonStreaming shape" approach as
// classify-message-confidence.ts's client type, for the same reason: a hand-rolled `readonly`
// mirror of `messages` isn't assignable to the SDK's own mutable `MessageParam[]`.
type ComposeTicketDraftClient = {
  readonly messages: {
    readonly parse: (
      params: Anthropic.MessageCreateParamsNonStreaming & {
        readonly output_config: { readonly format: typeof OUTPUT_FORMAT };
      },
    ) => Promise<{
      readonly parsed_output: TicketDraft | null;
      readonly usage: {
        readonly input_tokens: number;
        readonly output_tokens: number;
      };
    }>;
  };
};

export type ComposeTicketDraftParams = {
  readonly text: string;
};

export type ComposeTicketDraftUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type ComposeTicketDraftResult =
  | ({
      readonly ok: true;
      readonly usage: ComposeTicketDraftUsage;
    } & TicketDraft)
  | {
      readonly ok: false;
      readonly error: {
        readonly kind:
          'anthropic-api-error' | 'invalid-draft-output' | 'no-parsed-output';
        readonly message: string;
      };
    };

// Extracted purely to stay under `max-lines-per-function`, same precedent and same discrimination
// logic as `classify-message-confidence.ts`'s `toClassifyMessageConfidenceError` — `APIError`
// (request-level failures) must be checked before the more general `AnthropicError` it extends.
function toComposeTicketDraftError(
  error: unknown,
): Extract<ComposeTicketDraftResult, { readonly ok: false }> {
  if (error instanceof APIError) {
    return {
      ok: false,
      error: { kind: 'anthropic-api-error', message: error.message },
    };
  }
  if (error instanceof AnthropicError) {
    return {
      ok: false,
      error: { kind: 'invalid-draft-output', message: error.message },
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
 * BUILD_PLAN 3.4a-i's ticket-draft composition — VISION §5.2's High-band action, VISION §5.4's
 * "the LLM's job stops at deciding whether something looks like work and drafting it; everything
 * about what happens to a ticket after it exists is deterministic code" (this function only
 * drafts; committing a real `Ticket` row is 3.4a-ii's ✅ outcome path, deterministic, not this
 * call). `usage` passes through the API response's own token counts, same "stateless, caller
 * accounts for it" precedent as `generateReply`/`classifyMessageConfidence` — the real call site
 * gates this behind `checkCostCapAndAlert` and records cost via `sonnetCostUsdMicros`, same
 * mechanism as the DM reply path (BUILD_PLAN 2.6a/2.6b, and the lesson from 3.3's own DA finding:
 * every real, billed LLM call site needs this from the start, not discovered missing in review).
 */
export async function composeTicketDraft(
  client: ComposeTicketDraftClient,
  params: ComposeTicketDraftParams,
): Promise<ComposeTicketDraftResult> {
  try {
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: DRAFT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: params.text }],
      output_config: { format: OUTPUT_FORMAT },
    });

    if (message.parsed_output === null) {
      return {
        ok: false,
        error: {
          kind: 'no-parsed-output',
          message: 'ticket-draft response had no parsed_output',
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
    return toComposeTicketDraftError(error);
  }
}
