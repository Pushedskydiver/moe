import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { buildCachedSystemBlocks } from './build-cached-system-blocks.js';

// claude-sonnet-5 is VISION §10/§11's resolved "Sonnet-by-default" model — this is a compositional
// writing task (matching `generateReply`'s own use), not the cheap, high-volume classification
// gate `classify-message-confidence.ts` uses Haiku 4.5 for. `params.model` falls back to this when
// a caller doesn't override it — BUILD_PLAN 5.3a gave per-persona overrides a real config value
// (`resolvePersonaModel`); this function itself stays persona-agnostic.
const DEFAULT_MODEL = 'claude-sonnet-5';
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
// mirror of `messages` isn't assignable to the SDK's own mutable `MessageParam[]`. `usage`'s two
// cache fields (BUILD_PLAN 5.3a-ii — the real SDK's `ParsedMessage`/`Usage` shape, matched here
// since this system prompt now sets `cache_control`) are `number | null`, always present — not
// `?:` — the SDK always returns them once a request can cache, it just returns `null` when
// nothing did (DA review caught the original `?:` contradicting this exact comment).
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
        readonly cache_creation_input_tokens: number | null;
        readonly cache_read_input_tokens: number | null;
      };
    }>;
  };
};

export type ComposeTicketDraftParams = {
  readonly text: string;
  readonly model?: string;
  // Already-resolved value, not a `personaId` — mirrors `model`'s own "caller resolves the
  // persona-specific value, primitive stays generic/filesystem-free" shape (BUILD_PLAN 5.3a-ii).
  readonly personaPromptContent?: string;
};

export type ComposeTicketDraftUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens?: number;
  readonly cacheReadInputTokens?: number;
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
 * `params.model` defaults to `DEFAULT_MODEL` when omitted; the real call site
 * (`compose-ticket-draft-and-record-usage.ts`, shared by both of `handle-ambient-channel-message.ts`'s
 * and `reaction-outcome-actions.ts`'s own callers) always overrides it with
 * `resolvePersonaModel(deps.personaId)` instead (BUILD_PLAN 5.3a). `params.personaPromptContent`,
 * when given, prefixes the persona's own voice ahead of the fixed draft-composition instructions
 * (BUILD_PLAN 5.3a-ii) — omitted, `DRAFT_SYSTEM_PROMPT`'s own text is unchanged from before that
 * chunk, though the wire-level request shape isn't byte-for-byte identical even then: `system`
 * is now always a cached-block array (DA review), not a plain string, for every persona including
 * the 7 without a `prompt.md` yet. `usage`'s two cache fields are populated whenever the response
 * actually cached anything; `sonnetCostUsdMicros` prices them the same way it already does for
 * the DM reply path.
 */
export async function composeTicketDraft(
  client: ComposeTicketDraftClient,
  params: ComposeTicketDraftParams,
): Promise<ComposeTicketDraftResult> {
  try {
    const message = await client.messages.parse({
      model: params.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // Persona voice first (cacheable-if-large), task instructions last — the last block gets
      // `cache_control`, capturing the whole static prefix as one cached unit (BUILD_PLAN
      // 5.3a-ii). `undefined` when no persona has a real `prompt.md` yet — `DRAFT_SYSTEM_PROMPT`
      // alone, byte-for-byte the pre-5.3a-ii behavior.
      system: [
        ...buildCachedSystemBlocks([
          params.personaPromptContent,
          DRAFT_SYSTEM_PROMPT,
        ]),
      ],
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
        cacheCreationInputTokens:
          message.usage.cache_creation_input_tokens ?? undefined,
        cacheReadInputTokens:
          message.usage.cache_read_input_tokens ?? undefined,
      },
    };
  } catch (error) {
    return toComposeTicketDraftError(error);
  }
}
