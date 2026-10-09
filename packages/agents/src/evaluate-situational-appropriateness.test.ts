import type { Anthropic } from '@anthropic-ai/sdk';

import { AnthropicError, RateLimitError } from '@anthropic-ai/sdk';
import { parseMessage } from '@anthropic-ai/sdk/lib/parser';
import { describe, expect, it, vi } from 'vitest';

import { evaluateSituationalAppropriateness } from './evaluate-situational-appropriateness.js';

function makeClient(
  parsedOutput: {
    readonly appropriate: boolean;
    readonly reasoning: string;
  } | null,
  usage: { readonly input_tokens: number; readonly output_tokens: number } = {
    input_tokens: 40,
    output_tokens: 12,
  },
) {
  return {
    messages: {
      parse: vi.fn().mockResolvedValue({ parsed_output: parsedOutput, usage }),
    },
  };
}

describe('evaluateSituationalAppropriateness', () => {
  it('returns ok:true with appropriate:true, reasoning, and token usage for an ordinary work message', async () => {
    const client = makeClient({
      appropriate: true,
      reasoning: 'a routine bug report, nothing sensitive',
    });

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'the CLI hangs on large repos',
    });

    expect(result).toEqual({
      ok: true,
      appropriate: true,
      reasoning: 'a routine bug report, nothing sensitive',
      usage: { inputTokens: 40, outputTokens: 12 },
    });
  });

  it('returns ok:true with appropriate:false for a message describing a serious/sensitive situation', async () => {
    const client = makeClient({
      appropriate: false,
      reasoning: 'describes a round of layoffs, not a routine work item',
    });

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'just heard there are layoffs happening across the team today',
    });

    expect(result).toEqual({
      ok: true,
      appropriate: false,
      reasoning: 'describes a round of layoffs, not a routine work item',
      usage: { inputTokens: 40, outputTokens: 12 },
    });
  });

  it('sends the message as a single user turn with the Haiku model and the gate system prompt', async () => {
    const client = makeClient({ appropriate: true, reasoning: 'fine' });

    await evaluateSituationalAppropriateness(client, {
      text: 'something needs doing',
    });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-5-5',
        messages: [{ role: 'user', content: 'something needs doing' }],
      }),
    );
    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: string;
    };
    expect(call.system.length).toBeGreaterThan(0);
  });

  // BUILD_PLAN 3.14 — configuration C of 3.13's eval, same as the classifier's call.
  it('BUILD_PLAN 3.14 — asks Haiku 5.5 for effort low beside the schema format, with max_tokens 256', async () => {
    const client = makeClient({ appropriate: true, reasoning: 'fine' });

    await evaluateSituationalAppropriateness(client, { text: 'anything' });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      max_tokens: number;
      output_config: { effort?: string; format?: { type: string } };
    };
    expect(call.max_tokens).toBe(256);
    expect(call.output_config.effort).toBe('low');
    expect(call.output_config.format?.type).toBe('json_schema');
  });

  it('returns ok:false with kind no-parsed-output when parsed_output is null', async () => {
    const client = makeClient(null);

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'anything',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'no-parsed-output',
        message: 'situational-appropriateness response had no parsed_output',
      },
    });
  });

  it('returns ok:false with kind anthropic-api-error when the client throws a generic error', async () => {
    const client = {
      messages: {
        parse: vi.fn().mockRejectedValue(new Error('request timed out')),
      },
    };

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'anything',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'anthropic-api-error', message: 'request timed out' },
    });
  });

  it('handles a real RateLimitError the way @anthropic-ai/sdk actually throws it (an APIError subclass) as kind anthropic-api-error', async () => {
    const client = {
      messages: {
        parse: vi
          .fn()
          .mockRejectedValue(
            new RateLimitError(
              429,
              { message: 'Rate limit exceeded' },
              undefined,
              new Headers(),
            ),
          ),
      },
    };

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'anything',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'anthropic-api-error',
        message: '429 Rate limit exceeded',
      },
    });
  });

  it("returns ok:false with kind invalid-appropriateness-output when zodOutputFormat's own .parse() throws a bare AnthropicError (schema/JSON-parse failure, not a request-level failure)", async () => {
    const client = {
      messages: {
        parse: vi
          .fn()
          .mockRejectedValue(
            new AnthropicError(
              'Failed to parse structured output: invalid JSON',
            ),
          ),
      },
    };

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'anything',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-appropriateness-output',
        message: 'Failed to parse structured output: invalid JSON',
      },
    });
  });
});

// BUILD_PLAN 3.14 — Haiku 5.5 can end with `stop_reason: 'refusal'`. These run the SDK's own
// `parseMessage` (what `.parse()` runs over a real response) over two refusal-shaped responses, so
// the result is what the SDK would hand this function, not a hand-picked mock. The gate fails
// closed on either: `ok: false` is what `standing-proactive-guards.ts` treats as "do not post".
type GateParse = Parameters<
  typeof evaluateSituationalAppropriateness
>[0]['messages']['parse'];

function makeRefusedMessage(
  content: Anthropic.Message['content'],
): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    container: null,
    content,
    stop_details: {
      type: 'refusal',
      category: 'cyber',
      explanation: 'declined',
    },
    stop_reason: 'refusal',
    stop_sequence: null,
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 40,
      output_tokens: 3,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

function makeSdkParsingClient(response: Anthropic.Message) {
  const parse: GateParse = (params) =>
    Promise.resolve(parseMessage(response, params, { logger: console }));
  return { messages: { parse } };
}

describe('evaluateSituationalAppropriateness on a Haiku 5.5 refusal (BUILD_PLAN 3.14)', () => {
  it('returns ok:false with kind no-parsed-output when the refusal has no text block, so parsed_output is null', async () => {
    const client = makeSdkParsingClient(makeRefusedMessage([]));

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'anything',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'no-parsed-output',
        message: 'situational-appropriateness response had no parsed_output',
      },
    });
  });

  it('returns ok:false with kind invalid-appropriateness-output when the refusal stops partway through the text, which fails the schema as a bare AnthropicError', async () => {
    const client = makeSdkParsingClient(
      makeRefusedMessage([
        { type: 'text', text: '{"appropriate": fal', citations: null },
      ]),
    );

    const result = await evaluateSituationalAppropriateness(client, {
      text: 'anything',
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'invalid-appropriateness-output',
        message: expect.stringContaining('Failed to parse structured output'),
      },
    });
  });
});
