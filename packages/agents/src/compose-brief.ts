import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { buildCachedSystemBlocks } from './build-cached-system-blocks.js';

// claude-sonnet-5 is VISION §10's resolved "Sonnet-by-default" model — same choice
// `composeTicketDraft`/`composeConfirmingQuestionLeadIn` make for the identical reason (a
// compositional writing task, not the cheap high-volume classification gate Haiku is used for).
const DEFAULT_MODEL = 'claude-sonnet-5';
// A framing sentence plus an itemized scope list runs longer than a ticket-draft title+body, but
// well short of `composeConfirmingQuestionLeadIn`'s own adversarial-input ceiling — 768 gives
// comfortable headroom over VISION §1.3's own illustrative example (a summary plus "all 8
// packages listed").
const MAX_TOKENS = 768;

// BUILD_PLAN 6.1b's own Brief-stage composition. The model elaborates a framing summary plus an
// itemized scope list from the ticket's own title (and, when the ticket originated from a GitHub
// issue, its body) — it never sets `title` itself, since the ticket's title already exists (set
// at draft-commit or triage-conversion time, both deterministic, non-LLM steps per VISION §5.4);
// this call only elaborates it, never rewrites it. Same "don't invent, stay vague if the source
// is vague" discipline as `DRAFT_SYSTEM_PROMPT`.
const BRIEF_SYSTEM_PROMPT =
  'You compose a short work-scoping brief for a ticket that has already been created — a title, ' +
  'and optionally a fuller description fetched from its source GitHub issue. Produce a one-to-two ' +
  'sentence summary framing what the work is, and a scope list (a few items) breaking the work ' +
  'into concrete pieces. Do not invent details, causes, or scope items the title/description ' +
  "doesn't support — if the source is vague, keep the brief equally vague and general rather than " +
  'guessing at specifics. Never restate or invent a title of your own; the ticket already has one.';

const briefSchema = z.object({
  summary: z.string().min(1),
  scope: z.array(z.string().min(1)).min(1),
});

export type Brief = z.infer<typeof briefSchema>;

const OUTPUT_FORMAT = zodOutputFormat(briefSchema);

// Same "reuse the real Anthropic.MessageCreateParamsNonStreaming shape" approach as
// `compose-ticket-draft.ts`'s own client type, for the same reason — a hand-rolled `readonly`
// mirror of `messages` isn't assignable to the SDK's own mutable `MessageParam[]`.
type ComposeBriefClient = {
  readonly messages: {
    readonly parse: (
      params: Anthropic.MessageCreateParamsNonStreaming & {
        readonly output_config: { readonly format: typeof OUTPUT_FORMAT };
      },
    ) => Promise<{
      readonly parsed_output: Brief | null;
      readonly usage: {
        readonly input_tokens: number;
        readonly output_tokens: number;
        readonly cache_creation_input_tokens: number | null;
        readonly cache_read_input_tokens: number | null;
      };
    }>;
  };
};

export type ComposeBriefParams = {
  readonly title: string;
  // The freshly-fetched GitHub issue body (`getGithubIssueBody`, `@moe/github`), when the ticket
  // resolved to a linked GitHub issue — absent, the model works from `title` alone.
  readonly body?: string;
  readonly model?: string;
  // Already-resolved value, not a `personaId` — mirrors `composeTicketDraft`'s own
  // `personaPromptContent` shape (BUILD_PLAN 5.3a-ii): the caller resolves the persona-specific
  // value, this primitive stays generic/filesystem-free.
  readonly personaPromptContent?: string;
};

export type ComposeBriefUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens?: number;
  readonly cacheReadInputTokens?: number;
};

export type ComposeBriefResult =
  | ({
      readonly ok: true;
      readonly usage: ComposeBriefUsage;
    } & Brief)
  | {
      readonly ok: false;
      readonly error: {
        readonly kind:
          'anthropic-api-error' | 'invalid-brief-output' | 'no-parsed-output';
        readonly message: string;
      };
    };

// Extracted purely to stay under `max-lines-per-function`, same precedent and same discrimination
// logic as `compose-ticket-draft.ts`'s own `toComposeTicketDraftError` — `APIError`
// (request-level failures) must be checked before the more general `AnthropicError` it extends.
function toComposeBriefError(
  error: unknown,
): Extract<ComposeBriefResult, { readonly ok: false }> {
  if (error instanceof APIError) {
    return {
      ok: false,
      error: { kind: 'anthropic-api-error', message: error.message },
    };
  }
  if (error instanceof AnthropicError) {
    return {
      ok: false,
      error: { kind: 'invalid-brief-output', message: error.message },
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

// A GitHub issue can have a genuinely empty (not just absent) body — `getGithubIssueBody`
// normalizes a `null` body to `''` rather than `undefined` (`@moe/github`'s own schema allows any
// string). Trimmed-empty is treated the same as absent so a resolved-but-bodiless issue link still
// takes the title-only path, rather than appending a blank line after the title.
function formatUserTurn(params: ComposeBriefParams): string {
  const trimmedBody = params.body?.trim();
  return trimmedBody === undefined || trimmedBody === ''
    ? params.title
    : `${params.title}\n\n${trimmedBody}`;
}

/**
 * BUILD_PLAN 6.1b's brief composition — VISION §1.3's "Sarah's brief for the packages issue,"
 * given a real shape for the first time. `usage` passes through the API response's own token
 * counts, same "stateless, caller accounts for it" precedent as `composeTicketDraft` — the real
 * caller chain gates this behind `checkCostCapAndAlert` (`apps/server/src/handle-brief-stage-ticket.ts`,
 * one level above this function) and records cost via `sonnetCostUsdMicros`
 * (`apps/server/src/compose-brief-and-record-usage.ts`, the direct caller). `params.model` defaults to
 * `DEFAULT_MODEL` when omitted; the real call site always overrides it with
 * `resolvePersonaModel(deps.personaId)` instead. `params.personaPromptContent`, when given,
 * prefixes the persona's own voice ahead of the fixed brief-composition instructions, same
 * `buildCachedSystemBlocks` shape every other cascade function in this file's sibling modules
 * uses. No `severity`/`classOfService` fields anywhere in the output schema — structurally
 * impossible for the LLM to set them (VISION §5.4's deterministic-code-not-LLM rule for anything
 * with real consequences).
 */
export async function composeBrief(
  client: ComposeBriefClient,
  params: ComposeBriefParams,
): Promise<ComposeBriefResult> {
  try {
    const message = await client.messages.parse({
      model: params.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // Persona voice first (cacheable-if-large), task instructions last — the last block gets
      // `cache_control`, capturing the whole static prefix as one cached unit (same shape
      // `composeTicketDraft` already uses).
      system: [
        ...buildCachedSystemBlocks([
          params.personaPromptContent,
          BRIEF_SYSTEM_PROMPT,
        ]),
      ],
      messages: [{ role: 'user', content: formatUserTurn(params) }],
      output_config: { format: OUTPUT_FORMAT },
    });

    if (message.parsed_output === null) {
      return {
        ok: false,
        error: {
          kind: 'no-parsed-output',
          message: 'brief response had no parsed_output',
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
    return toComposeBriefError(error);
  }
}
