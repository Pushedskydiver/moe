import { AnthropicError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { composePlan } from './compose-plan.js';

function makeClient(
  parsedOutput: {
    readonly approach: string;
    readonly confidence: string;
    readonly alternativesConsidered: readonly string[];
    readonly openQuestions: readonly string[];
  } | null,
  usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_creation_input_tokens: number | null;
    readonly cache_read_input_tokens: number | null;
  } = {
    input_tokens: 180,
    output_tokens: 90,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
  },
) {
  return {
    messages: {
      parse: vi.fn().mockResolvedValue({ parsed_output: parsedOutput, usage }),
    },
  };
}

describe('composePlan', () => {
  it('returns ok:true with the composed approach, confidence, alternatives, open questions, and token usage', async () => {
    const client = makeClient({
      approach: 'Add a bounded retry count with a sane default.',
      confidence: 'High — the retry loop is small and easy to reason about.',
      alternativesConsidered: ['Exponential backoff', 'Dead-lettering'],
      openQuestions: ['What happens after retries are exhausted?'],
    });

    const result = await composePlan(client, {
      title: 'webhook delivery retries indefinitely',
      briefSummary: 'Fix unbounded webhook retries.',
      briefScope: ['Add a maximum retry count'],
    });

    expect(result).toEqual({
      ok: true,
      approach: 'Add a bounded retry count with a sane default.',
      confidence: 'High — the retry loop is small and easy to reason about.',
      alternativesConsidered: ['Exponential backoff', 'Dead-lettering'],
      openQuestions: ['What happens after retries are exhausted?'],
      usage: { inputTokens: 180, outputTokens: 90 },
    });
  });

  it('sends the title and brief summary/scope as the user turn', async () => {
    const client = makeClient({
      approach: 'x',
      confidence: 'y',
      alternativesConsidered: [],
      openQuestions: [],
    });

    await composePlan(client, {
      title: 'webhook delivery retries indefinitely',
      briefSummary: 'Fix unbounded webhook retries.',
      briefScope: ['Add a maximum retry count', 'Decide what happens after'],
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0]?.content).toContain(
      'webhook delivery retries indefinitely',
    );
    expect(call.messages[0]?.content).toContain(
      'Fix unbounded webhook retries.',
    );
    expect(call.messages[0]?.content).toContain('Add a maximum retry count');
    expect(call.messages[0]?.content).toContain('Decide what happens after');
  });

  it('allows empty alternativesConsidered/openQuestions arrays (no .min(1))', async () => {
    const client = makeClient({
      approach: 'x',
      confidence: 'y',
      alternativesConsidered: [],
      openQuestions: [],
    });

    const result = await composePlan(client, {
      title: 'something small',
      briefSummary: 'summary',
      briefScope: ['one item'],
    });

    expect(result).toEqual({
      ok: true,
      approach: 'x',
      confidence: 'y',
      alternativesConsidered: [],
      openQuestions: [],
      usage: { inputTokens: 180, outputTokens: 90 },
    });
  });

  it('uses the given model override instead of the sonnet-5 default when provided', async () => {
    const client = makeClient({
      approach: 'x',
      confidence: 'y',
      alternativesConsidered: [],
      openQuestions: [],
    });

    await composePlan(client, {
      title: 'something needs planning',
      briefSummary: 'summary',
      briefScope: [],
      model: 'claude-opus-5',
    });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-5' }),
    );
  });

  it('defaults to the sonnet-5 model when no override is given', async () => {
    const client = makeClient({
      approach: 'x',
      confidence: 'y',
      alternativesConsidered: [],
      openQuestions: [],
    });

    await composePlan(client, {
      title: 'something needs planning',
      briefSummary: 'summary',
      briefScope: [],
    });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' }),
    );
  });

  it('prepends personaPromptContent ahead of the plan task instructions when given', async () => {
    const client = makeClient({
      approach: 'x',
      confidence: 'y',
      alternativesConsidered: [],
      openQuestions: [],
    });

    await composePlan(client, {
      title: 'something needs planning',
      briefSummary: 'summary',
      briefScope: [],
      personaPromptContent: "You're Marcus, moe's Architect.",
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(2);
    expect(call.system[0]?.text).toBe("You're Marcus, moe's Architect.");
  });

  it('omits the persona block when personaPromptContent is not given', async () => {
    const client = makeClient({
      approach: 'x',
      confidence: 'y',
      alternativesConsidered: [],
      openQuestions: [],
    });

    await composePlan(client, {
      title: 'something needs planning',
      briefSummary: 'summary',
      briefScope: [],
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(1);
  });

  it('returns ok:false with kind no-parsed-output when parsed_output is null', async () => {
    const client = makeClient(null);

    const result = await composePlan(client, {
      title: 'anything',
      briefSummary: 'summary',
      briefScope: [],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'no-parsed-output',
        message: 'plan response had no parsed_output',
      },
    });
  });

  it('returns ok:false with kind anthropic-api-error when the client throws a generic error', async () => {
    const client = {
      messages: {
        parse: vi.fn().mockRejectedValue(new Error('request timed out')),
      },
    };

    const result = await composePlan(client, {
      title: 'anything',
      briefSummary: 'summary',
      briefScope: [],
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'anthropic-api-error', message: 'request timed out' },
    });
  });

  it('returns ok:false with kind invalid-plan-output when zodOutputFormat throws a bare AnthropicError (schema/JSON-parse failure)', async () => {
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

    const result = await composePlan(client, {
      title: 'anything',
      briefSummary: 'summary',
      briefScope: [],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-plan-output',
        message: 'Failed to parse structured output: invalid JSON',
      },
    });
  });
});
