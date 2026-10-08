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
 * `onCapture`, then returns `parseMessage` of it, which is exactly what the SDK's own `parse`
 * does (`create(...).then(parseMessage)` in 0.111.0). Capturing before parsing keeps the
 * `stop_reason` of a refusal or a cut, which the SDK's `.parse()` would otherwise turn into a
 * bare thrown `AnthropicError` the production function can only bucket as an invalid output.
 *
 * `effort` is merged into the incoming `output_config`, never a replacement of it, so
 * production's own `format` survives; a configuration with no `effort` adds no key at all.
 * `onCapture` is not called when the request itself fails, since no response exists.
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
            ...params.output_config,
            ...(configuration.effort === undefined
              ? {}
              : { effort: configuration.effort }),
          },
        };

        const message = await real.messages.create(rewritten);
        onCapture(captureFrom(message));

        return parseMessage(message, rewritten, { logger: console });
      },
    },
  };
}
