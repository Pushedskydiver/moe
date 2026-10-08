import type { EvalConfiguration } from './eval-configurations.js';
import type { RawCapture } from './recording-eval-client.js';
import type { Anthropic } from '@anthropic-ai/sdk';

import { APIConnectionError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { classifyMessageConfidence } from '../classify-message-confidence.js';
import { evaluateSituationalAppropriateness } from '../evaluate-situational-appropriateness.js';
import { EVAL_CONFIGURATIONS } from './eval-configurations.js';
import { makeRecordingEvalClient } from './recording-eval-client.js';

const [configA, configB, configC, configD] = EVAL_CONFIGURATIONS as readonly [
  EvalConfiguration,
  EvalConfiguration,
  EvalConfiguration,
  EvalConfiguration,
];

function makeMessage(options: {
  readonly content: Anthropic.Message['content'];
  readonly stopReason?: Anthropic.Message['stop_reason'];
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly thinkingTokens?: number;
}): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    container: null,
    content: options.content,
    stop_details: null,
    stop_reason: options.stopReason ?? 'end_turn',
    stop_sequence: null,
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: options.inputTokens ?? 40,
      output_tokens: options.outputTokens ?? 12,
      output_tokens_details:
        options.thinkingTokens === undefined
          ? null
          : { thinking_tokens: options.thinkingTokens },
      server_tool_use: null,
      service_tier: null,
    },
  };
}

function textBlock(text: string): Anthropic.TextBlock {
  return { type: 'text', text, citations: null };
}

function makeReal(message: Anthropic.Message) {
  return {
    messages: { create: vi.fn().mockResolvedValue(message) },
  };
}

function makeClient(
  real: ReturnType<typeof makeReal>,
  configuration: EvalConfiguration,
) {
  const onCapture = vi.fn<(capture: RawCapture) => void>();
  return {
    client: makeRecordingEvalClient(real, configuration, onCapture),
    onCapture,
  };
}

const classifierJson = JSON.stringify({ confidence: 81, reasoning: 'a bug' });

function sentParams(real: ReturnType<typeof makeReal>) {
  return real.messages.create.mock
    .calls[0]?.[0] as Anthropic.MessageCreateParamsNonStreaming;
}

describe('makeRecordingEvalClient', () => {
  it('runs the production classifier unchanged, calling create (not parse) and returning the parsed result', async () => {
    const real = makeReal(
      makeMessage({ content: [textBlock(classifierJson)] }),
    );
    const { client } = makeClient(real, configA);

    const result = await classifyMessageConfidence(client, {
      text: 'the CLI hangs',
    });

    expect(result).toEqual({
      ok: true,
      confidence: 81,
      reasoning: 'a bug',
      usage: { inputTokens: 40, outputTokens: 12 },
    });
    expect(real.messages.create).toHaveBeenCalledTimes(1);
  });

  it('rewrites model and max_tokens for the configuration and leaves the production prompt, messages and format alone', async () => {
    const real = makeReal(
      makeMessage({ content: [textBlock(classifierJson)] }),
    );
    const { client } = makeClient(real, configD);

    await classifyMessageConfidence(client, { text: 'the CLI hangs' });

    const sent = sentParams(real);
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent.max_tokens).toBe(1024);
    expect(sent.messages).toEqual([{ role: 'user', content: 'the CLI hangs' }]);
    expect(sent.system).toContain('triage classifier');
    expect(sent.output_config?.format?.type).toBe('json_schema');
  });

  it("merges effort into the incoming output_config for configuration C, keeping production's format", async () => {
    const real = makeReal(
      makeMessage({ content: [textBlock(classifierJson)] }),
    );
    const { client } = makeClient(real, configC);

    await classifyMessageConfidence(client, { text: 'hello' });

    const sent = sentParams(real);
    expect(sent.output_config?.effort).toBe('low');
    expect(sent.output_config?.format?.type).toBe('json_schema');
  });

  it('sets no effort key at all on configurations A, B and D', async () => {
    const keysSent = await Promise.all(
      [configA, configB, configD].map(async (configuration) => {
        const real = makeReal(
          makeMessage({ content: [textBlock(classifierJson)] }),
        );
        const { client } = makeClient(real, configuration);
        await classifyMessageConfidence(client, { text: 'hello' });
        return Object.keys(sentParams(real).output_config ?? {});
      }),
    );

    expect(keysSent).toEqual([['format'], ['format'], ['format']]);
  });

  it('reports stop_reason, content block types and usage, including thinking tokens', async () => {
    const real = makeReal(
      makeMessage({
        content: [
          { type: 'thinking', thinking: '...', signature: 's' },
          textBlock(classifierJson),
        ],
        inputTokens: 300,
        outputTokens: 180,
        thinkingTokens: 150,
      }),
    );
    const { client, onCapture } = makeClient(real, configB);

    await classifyMessageConfidence(client, { text: 'hello' });

    expect(onCapture.mock.calls).toEqual([
      [
        {
          stopReason: 'end_turn',
          contentBlockTypes: ['thinking', 'text'],
          usage: { inputTokens: 300, outputTokens: 180, thinkingTokens: 150 },
        },
      ],
    ]);
  });

  it("keeps a cut response's stop_reason even though the production function reports only a no-parsed-output failure", async () => {
    const real = makeReal(
      makeMessage({
        content: [{ type: 'thinking', thinking: '...', signature: 's' }],
        stopReason: 'max_tokens',
        outputTokens: 256,
      }),
    );
    const { client, onCapture } = makeClient(real, configB);

    const result = await classifyMessageConfidence(client, { text: 'hello' });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'no-parsed-output' },
    });
    expect(onCapture.mock.calls[0]?.[0]).toMatchObject({
      stopReason: 'max_tokens',
      contentBlockTypes: ['thinking'],
      usage: { outputTokens: 256, thinkingTokens: null },
    });
  });

  it("keeps a refusal's stop_reason when the text isn't valid JSON, which .parse() alone would turn into a bare AnthropicError", async () => {
    const real = makeReal(
      makeMessage({
        content: [textBlock("I can't help with that.")],
        stopReason: 'refusal',
      }),
    );
    const { client, onCapture } = makeClient(real, configA);

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'hello',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid-appropriateness-output' },
    });
    expect(onCapture.mock.calls[0]?.[0].stopReason).toBe('refusal');
  });

  it('reports nothing when the request itself fails, and lets the error through for the production function to bucket', async () => {
    const real = {
      messages: {
        create: vi
          .fn()
          .mockRejectedValue(
            new APIConnectionError({ message: 'socket hang up' }),
          ),
      },
    };
    const { client, onCapture } = makeClient(real, configA);

    const result = await classifyMessageConfidence(client, { text: 'hello' });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'anthropic-api-error' },
    });
    expect(onCapture).not.toHaveBeenCalled();
  });

  it("parses with the format the caller passed, so any production call site's schema works", async () => {
    const schema = z.object({ answer: z.number() });
    const real = makeReal(
      makeMessage({ content: [textBlock('{"answer":4}')] }),
    );
    const { client } = makeClient(real, configA);

    const message = await client.messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
      output_config: { format: zodOutputFormat(schema) },
    });

    expect(message.parsed_output).toEqual({ answer: 4 });
  });
});
