import { AnthropicError, RateLimitError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { classifyMessageConfidence } from './classify-message-confidence.js';

function makeClient(
  parsedOutput: {
    readonly confidence: number;
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

describe('classifyMessageConfidence', () => {
  it('returns ok:true with the confidence score, reasoning, and token usage on a successful parse', async () => {
    const client = makeClient(
      { confidence: 87, reasoning: 'describes a concrete bug to fix' },
      { input_tokens: 40, output_tokens: 12 },
    );

    const result = await classifyMessageConfidence(client, {
      text: 'the CLI hangs on large repos',
    });

    expect(result).toEqual({
      ok: true,
      confidence: 87,
      reasoning: 'describes a concrete bug to fix',
      usage: { inputTokens: 40, outputTokens: 12 },
    });
  });

  it('sends the message as a single user turn with the Haiku model and the classifier system prompt', async () => {
    const client = makeClient({ confidence: 10, reasoning: 'pure banter' });

    await classifyMessageConfidence(client, { text: 'lol nice one' });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'lol nice one' }],
      }),
    );
    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: string;
    };
    expect(call.system.length).toBeGreaterThan(0);
  });

  it('returns ok:false with kind no-parsed-output when parsed_output is null', async () => {
    const client = makeClient(null);

    const result = await classifyMessageConfidence(client, {
      text: 'anything',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'no-parsed-output',
        message: 'classifier response had no parsed_output',
      },
    });
  });

  it('returns ok:false with kind anthropic-api-error when the client throws a generic error (network failure, timeout, etc.)', async () => {
    const client = {
      messages: {
        parse: vi.fn().mockRejectedValue(new Error('request timed out')),
      },
    };

    const result = await classifyMessageConfidence(client, {
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

    const result = await classifyMessageConfidence(client, {
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

  it("returns ok:false with kind invalid-classification-output when zodOutputFormat's own .parse() throws a bare AnthropicError (schema/JSON-parse failure, not a request-level failure) — verified against the installed SDK's actual source", async () => {
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

    const result = await classifyMessageConfidence(client, {
      text: 'anything',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-classification-output',
        message: 'Failed to parse structured output: invalid JSON',
      },
    });
  });
});
