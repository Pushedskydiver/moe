import { AnthropicError, RateLimitError } from '@anthropic-ai/sdk';
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
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'something needs doing' }],
      }),
    );
    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: string;
    };
    expect(call.system.length).toBeGreaterThan(0);
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
