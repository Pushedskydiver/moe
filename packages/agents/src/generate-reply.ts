import type { Anthropic } from '@anthropic-ai/sdk';

import { PLACEHOLDER_SYSTEM_PROMPT } from './placeholder-system-prompt.js';

// claude-sonnet-5 is VISION §10's resolved "Sonnet-by-default" answer (docs/VISION.md, added
// 2026-07-15) — the default `params.model` falls back to when a caller doesn't override it.
// BUILD_PLAN 5.3a gave per-persona overrides a real config value (`resolvePersonaModel`); this
// function itself stays persona-agnostic, same shape as its own pre-existing `system` param.
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1024;

type GenerateReplyClient = {
  readonly messages: {
    readonly create: (
      params: Anthropic.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Message>;
  };
};

export type GenerateReplyToolUse = {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
};

export type GenerateReplyParams = {
  readonly text: string;
  readonly tools?: ReadonlyArray<Anthropic.Tool>;
  readonly history?: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>;
  readonly system?: string | ReadonlyArray<Anthropic.TextBlockParam>;
  readonly model?: string;
};

export type GenerateReplyUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens?: number;
  readonly cacheReadInputTokens?: number;
};

export type GenerateReplyResult =
  | {
      readonly ok: true;
      readonly reply: string;
      readonly toolUses: readonly GenerateReplyToolUse[];
      readonly usage: GenerateReplyUsage;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'anthropic-api-error' | 'no-content';
        readonly message: string;
      };
    };

function toGenerateReplyResult(
  message: Anthropic.Message,
): GenerateReplyResult {
  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  const toolUses: readonly GenerateReplyToolUse[] = message.content
    .filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )
    .map((block) => ({ id: block.id, name: block.name, input: block.input }));

  if (textBlock === undefined && toolUses.length === 0) {
    return {
      ok: false,
      error: {
        kind: 'no-content',
        message: `no text or tool_use content block in response (stop_reason: ${message.stop_reason ?? 'unknown'})`,
      },
    };
  }

  return {
    ok: true,
    reply: textBlock?.text ?? '',
    toolUses,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      // `?? undefined` (not `?? 0`): the SDK types these `number | null`, and omitting the key
      // entirely when null/absent — rather than writing an explicit 0 — keeps every pre-caching
      // call site's exact-shape usage object unchanged (BUILD_PLAN 5.3a-ii).
      cacheCreationInputTokens:
        message.usage.cache_creation_input_tokens ?? undefined,
      cacheReadInputTokens: message.usage.cache_read_input_tokens ?? undefined,
    },
  };
}

/**
 * Calls the Anthropic Messages API (`docs/VISION.md` §11's verified model-client choice). `system`
 * defaults to `PLACEHOLDER_SYSTEM_PROMPT` (a generic, no-persona-named fallback) when omitted; the
 * real call site (`apps/server/src/generate-and-post-reply.ts`) always overrides it with
 * `buildPersonaSystemPrompt(personaId)` instead — a plain string or, once a persona has a real
 * `prompt.md` (BUILD_PLAN 5.3a-ii), a cached-block array; either form is accepted and spread into
 * a fresh mutable array before reaching the SDK, which requires one. `model` defaults to
 * `DEFAULT_MODEL` (`claude-sonnet-5`) when omitted; the same real call site always overrides it
 * with `resolvePersonaModel(deps.personaId)` instead (BUILD_PLAN 5.3a) — same "primitive stays
 * persona-agnostic, caller resolves the persona-specific value" shape as `system`. `history`, when
 * provided, is forwarded ahead of `text` as prior turns (BUILD_PLAN 2.4b) — this function itself
 * is stateless (it never reads or writes any store), the caller decides what history to pass, if
 * any. `tools`, when provided, passes through to the API call as inline JSON-schema definitions
 * (not MCP) — the real call site always passes the `report_status` status-claim tool (BUILD_PLAN
 * 2.5); `reply` is the response's text block content (`''` if none), and `toolUses` collects every
 * `tool_use` content block verbatim, letting the caller decide what to do with either. `usage`
 * passes through the API response's own `input_tokens`/`output_tokens` counts verbatim (BUILD_PLAN
 * 2.6a) — this function stays stateless, so it reports usage rather than accounting for it; the
 * real call site is what turns this into a persisted cost record.
 */
export async function generateReply(
  client: GenerateReplyClient,
  params: GenerateReplyParams,
): Promise<GenerateReplyResult> {
  try {
    const system = params.system ?? PLACEHOLDER_SYSTEM_PROMPT;
    const message = await client.messages.create({
      model: params.model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // The SDK's own `system` field wants a mutable array; `params.system` (widened for
      // `buildPersonaSystemPrompt`'s cached-block-array shape, BUILD_PLAN 5.3a-ii) is typed
      // `ReadonlyArray` — spread into a fresh mutable array, same treatment `tools` gets below.
      system: typeof system === 'string' ? system : [...system],
      messages: [
        ...(params.history ?? []),
        { role: 'user', content: params.text },
      ],
      ...(params.tools !== undefined ? { tools: [...params.tools] } : {}),
    });

    return toGenerateReplyResult(message);
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
