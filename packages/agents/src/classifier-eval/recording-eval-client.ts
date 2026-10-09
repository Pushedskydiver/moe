import type { EvalConfiguration } from './eval-configurations.js';
import type { Anthropic } from '@anthropic-ai/sdk';
import type {
  AutoParseableOutputFormat,
  ParsedMessage,
} from '@anthropic-ai/sdk/lib/parser';

import { parseMessage } from '@anthropic-ai/sdk/lib/parser';

/**
 * What the wrapper read off the raw API response before parsing it. `thinkingTokens` is the API's
 * `usage.output_tokens_details.thinking_tokens` (already inside `outputTokens`), `null` when the
 * response carried no breakdown.
 */
export type RawCapture = {
  readonly stopReason: Anthropic.StopReason | null;
  // The API's own account of a refusal; `null` when the response carried none.
  readonly stopDetails: Anthropic.RefusalStopDetails | null;
  readonly contentBlockTypes: readonly string[];
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly thinkingTokens: number | null;
  };
};

/** The one real-client method the wrapper calls. */
export type EvalCreateClient = {
  readonly messages: {
    readonly create: (
      params: Anthropic.MessageCreateParamsNonStreaming,
    ) => PromiseLike<Anthropic.Message>;
  };
};

type EvalParseParams<Parsed> = Anthropic.MessageCreateParamsNonStreaming & {
  readonly output_config: {
    readonly format: AutoParseableOutputFormat<Parsed>;
  };
};

function captureFrom(message: Anthropic.Message): RawCapture {
  return {
    stopReason: message.stop_reason,
    stopDetails: message.stop_details,
    contentBlockTypes: message.content.map((block) => block.type),
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      thinkingTokens:
        message.usage.output_tokens_details?.thinking_tokens ?? null,
    },
  };
}

/**
 * BUILD_PLAN 3.13's eval client. The production functions `classifyMessageConfidence` and
 * `evaluateSituationalAppropriateness` call `client.messages.parse`, so this stands in for a
 * client: its `parse` rewrites `model`, `max_tokens` and `output_config.effort` for the
 * configuration, calls the real client's `messages.create`, reports the raw response to
 * `onCapture`, then returns `parseMessage` of it, the same parse step the SDK's own `parse` runs
 * (`create(...).then(parseMessage)` in 0.111.0). Without the capture, a response cut or refused
 * partway through its text reaches the production function as a bare `AnthropicError`, which it
 * reports as an invalid-output kind, and one that stops before any text as `no-parsed-output`;
 * neither says whether it was a cut or a refusal. The capture keeps the `stop_reason` and the
 * `stop_details`.
 *
 * The configuration owns `effort`. Production's own calls send `effort: 'low'` since BUILD_PLAN
 * 3.14, so the wrapper drops an incoming `effort` and sets the configuration's, if it has one:
 * a configuration with no `effort` sends none at all. Production's own `format` is kept, the only
 * other key either call sends. `onCapture` is not called when the request itself fails, since no
 * response exists.
 */
export function makeRecordingEvalClient(
  real: EvalCreateClient,
  configuration: EvalConfiguration,
  onCapture: (capture: RawCapture) => void,
) {
  return {
    messages: {
      parse: async <Parsed>(
        params: EvalParseParams<Parsed>,
      ): Promise<ParsedMessage<Parsed>> => {
        const rewritten: EvalParseParams<Parsed> = {
          ...params,
          model: configuration.model,
          max_tokens: configuration.maxTokens,
          output_config: {
            format: params.output_config.format,
            ...(configuration.effort === undefined
              ? {}
              : { effort: configuration.effort }),
          },
        };

        const message = await real.messages.create(rewritten);
        onCapture(captureFrom(message));

        // `parseMessage` in 0.111.0 never reads its logger option (`lib/parser.ts`), so `console`
        // here bypasses no redaction.
        return parseMessage(message, rewritten, { logger: console });
      },
    },
  };
}
