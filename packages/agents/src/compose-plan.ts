import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { buildCachedSystemBlocks } from './build-cached-system-blocks.js';

// claude-sonnet-5 is VISION §10's resolved "Sonnet-by-default" model — same choice `composeBrief`
// makes for the identical reason (a compositional writing/judgment task, not the cheap
// high-volume classification gate Haiku is used for).
const DEFAULT_MODEL = 'claude-sonnet-5';
// A richer schema than Brief's two fields (four fields, two of them arrays) — 768 (Brief's own
// value) doubled to 1536 was the first estimate, but a real recorded fixture (BUILD_PLAN 6.1c's
// own `plan-approach-does-not-invent-unstated-cause` scenario) truncated mid-JSON-string at 1536
// on repeated live attempts (an `invalid-plan-output` `AnthropicError`, "Unterminated string in
// JSON" — the SDK's own structured-output helper throws when `max_tokens` cuts the response off
// before the JSON closes, rather than surfacing a clean `stop_reason: 'max_tokens'` the way a
// plain-text response would) — confirmed empirically, not a guess: a genuine Architect-voiced
// four-field judgment call (an approach paragraph, a confidence statement with its own reasoning,
// several alternatives, several open questions) needs materially more headroom than Brief's own
// two-field framing-plus-list output. 4096 gives comfortable headroom over the real recorded
// response's own size.
const MAX_TOKENS = 4096;

// BUILD_PLAN 6.1c's own Plan-stage composition. The model elaborates a concrete approach from the
// ticket's own title plus its already-composed Brief (summary + scope) — it never invents a title
// or brief content of its own, since both already exist by the time this call runs. Grounded
// directly in Marcus's own shipped `prompt.md` (`packages/agents/src/personas/marcus/prompt.md`):
// "Focus on getting the judgment right: what the approach is, what you're confident about, what
// you're not, and what alternatives you considered for anything substantial." Same "don't invent,
// stay vague if the source is vague" discipline as `BRIEF_SYSTEM_PROMPT`, extended here to say the
// plan must not invent specifics the brief doesn't support either.
const PLAN_SYSTEM_PROMPT =
  'You compose a plan for a ticket that already has a title and a work-scoping brief (a summary ' +
  'plus a scope list) — elaborate a concrete approach grounded in that brief. Name what you are ' +
  "confident about and what you're not, name alternatives you considered for anything substantial " +
  '(a short or empty list is fine for anything small), and name any genuinely open questions (a ' +
  'short or empty list is fine when nothing is open). Do not invent details, causes, or specifics ' +
  "the title/brief doesn't support — if the source is vague, keep the plan equally honest about " +
  'that rather than guessing. Never restate or invent a title or brief of your own; both already ' +
  'exist.';

const planSchema = z.object({
  approach: z.string().min(1),
  confidence: z.string().min(1),
  alternativesConsidered: z.array(z.string().min(1)),
  openQuestions: z.array(z.string().min(1)),
});

export type Plan = z.infer<typeof planSchema>;

const OUTPUT_FORMAT = zodOutputFormat(planSchema);

// Same "reuse the real Anthropic.MessageCreateParamsNonStreaming shape" approach as
// `compose-brief.ts`'s own client type, for the same reason — a hand-rolled `readonly` mirror of
// `messages` isn't assignable to the SDK's own mutable `MessageParam[]`.
type ComposePlanClient = {
  readonly messages: {
    readonly parse: (
      params: Anthropic.MessageCreateParamsNonStreaming & {
        readonly output_config: { readonly format: typeof OUTPUT_FORMAT };
      },
    ) => Promise<{
      readonly parsed_output: Plan | null;
      readonly usage: {
        readonly input_tokens: number;
        readonly output_tokens: number;
        readonly cache_creation_input_tokens: number | null;
        readonly cache_read_input_tokens: number | null;
      };
    }>;
  };
};

export type ComposePlanParams = {
  readonly title: string;
  // The ticket's already-composed Brief content (`packages/core`'s widened `ticket_briefs` row,
  // BUILD_PLAN 6.1c's own B1 fix) — the required grounding for a plan. No `body`/GitHub-issue-body
  // field: Marcus's own prompt has no live-codebase-read tool, and the Brief is already the
  // distilled version of that context by the time a ticket reaches Plan.
  readonly briefSummary: string;
  readonly briefScope: readonly string[];
  readonly model?: string;
  // Already-resolved value, not a `personaId` — mirrors `composeBrief`'s own `personaPromptContent`
  // shape: the caller resolves the persona-specific value, this primitive stays generic/
  // filesystem-free.
  readonly personaPromptContent?: string;
};

export type ComposePlanUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens?: number;
  readonly cacheReadInputTokens?: number;
};

export type ComposePlanResult =
  | ({
      readonly ok: true;
      readonly usage: ComposePlanUsage;
    } & Plan)
  | {
      readonly ok: false;
      readonly error: {
        readonly kind:
          'anthropic-api-error' | 'invalid-plan-output' | 'no-parsed-output';
        readonly message: string;
      };
    };

// Extracted purely to stay under `max-lines-per-function`, same precedent and same discrimination
// logic as `compose-brief.ts`'s own `toComposeBriefError` — `APIError` (request-level failures)
// must be checked before the more general `AnthropicError` it extends.
function toComposePlanError(
  error: unknown,
): Extract<ComposePlanResult, { readonly ok: false }> {
  if (error instanceof APIError) {
    return {
      ok: false,
      error: { kind: 'anthropic-api-error', message: error.message },
    };
  }
  if (error instanceof AnthropicError) {
    return {
      ok: false,
      error: { kind: 'invalid-plan-output', message: error.message },
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

function formatUserTurn(params: ComposePlanParams): string {
  const scopeLines = params.briefScope.map((item) => `- ${item}`).join('\n');
  return `${params.title}\n\n${params.briefSummary}\n\n${scopeLines}`;
}

/**
 * BUILD_PLAN 6.1c's plan composition — Marcus's judgment call given a real shape for the first
 * time. `usage` passes through the API response's own token counts, same "stateless, caller
 * accounts for it" precedent as `composeBrief` — the real caller chain gates this behind
 * `checkCostCapAndAlert` (`apps/server/src/handle-plan-stage-ticket.ts`, one level above this
 * function) and records cost via `sonnetCostUsdMicros`
 * (`apps/server/src/compose-plan-and-record-usage.ts`, the direct caller). `params.model` defaults
 * to `DEFAULT_MODEL` when omitted; the real call site always overrides it with
 * `resolvePersonaModel(deps.personaId)` instead. `params.personaPromptContent`, when given,
 * prefixes the persona's own voice ahead of the fixed plan-composition instructions, same
 * `buildCachedSystemBlocks` shape every other cascade function in this file's sibling modules
 * uses.
 */
export async function composePlan(
  client: ComposePlanClient,
  params: ComposePlanParams,
): Promise<ComposePlanResult> {
  try {
    const message = await client.messages.parse({
      model: params.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // Persona voice first (cacheable-if-large), task instructions last — the last block gets
      // `cache_control`, capturing the whole static prefix as one cached unit (same shape
      // `composeBrief` already uses).
      system: [
        ...buildCachedSystemBlocks([
          params.personaPromptContent,
          PLAN_SYSTEM_PROMPT,
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
          message: 'plan response had no parsed_output',
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
    return toComposePlanError(error);
  }
}
