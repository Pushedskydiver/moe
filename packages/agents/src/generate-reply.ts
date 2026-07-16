import type { Anthropic } from '@anthropic-ai/sdk';

import { PLACEHOLDER_SYSTEM_PROMPT } from './placeholder-system-prompt.js';

// claude-sonnet-5 is VISION §10's resolved "Sonnet-by-default" answer (docs/VISION.md, added
// 2026-07-15) — this is the chunk that actually wires a model in, per that note's own framing.
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1024;

type GenerateReplyClient = {
  readonly messages: {
    readonly create: (
      params: Anthropic.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Message>;
  };
};

export type GenerateReplyParams = {
  readonly text: string;
  readonly tools?: ReadonlyArray<Anthropic.Tool>;
};

export type GenerateReplyResult =
  | { readonly ok: true; readonly reply: string }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'anthropic-api-error' | 'no-text-content';
        readonly message: string;
      };
    };

/**
 * Single-turn, stateless call to the Anthropic Messages API (`docs/VISION.md` §11's verified
 * model-client choice) in a deliberately generic, non-persona placeholder voice — thread-scoped
 * conversation state arrives at BUILD_PLAN 2.4b, not here. `tools`, when provided, passes through
 * to the API call as inline JSON-schema definitions (not MCP) — BUILD_PLAN 2.4a's own proof that
 * the client wiring supports them, even though no real tool is wired to anything yet.
 */
export async function generateReply(
  client: GenerateReplyClient,
  params: GenerateReplyParams,
): Promise<GenerateReplyResult> {
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: PLACEHOLDER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: params.text }],
      ...(params.tools !== undefined ? { tools: [...params.tools] } : {}),
    });

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );

    return textBlock
      ? { ok: true, reply: textBlock.text }
      : {
          ok: false,
          error: {
            kind: 'no-text-content',
            message: `no text content block in response (stop_reason: ${message.stop_reason ?? 'unknown'})`,
          },
        };
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
