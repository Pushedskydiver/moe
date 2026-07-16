import { RateLimitError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { generateReply } from './generate-reply.js';
import { PLACEHOLDER_SYSTEM_PROMPT } from './placeholder-system-prompt.js';

function makeClient(
  response:
    | {
        readonly content: ReadonlyArray<
          { readonly type: string; readonly text?: string } & Record<
            string,
            unknown
          >
        >;
        readonly stop_reason?: string;
      }
    | (() => never),
) {
  return {
    messages: {
      create:
        typeof response === 'function'
          ? vi.fn(response)
          : vi.fn().mockResolvedValue(response),
    },
  };
}

const TEXT_MESSAGE = {
  content: [{ type: 'text', text: 'Hi there!', citations: null }],
  stop_reason: 'end_turn',
};

describe('generateReply', () => {
  it('returns ok:true with the extracted text on a successful turn', async () => {
    const client = makeClient(TEXT_MESSAGE);

    const result = await generateReply(client, { text: 'hello' });

    expect(result).toEqual({ ok: true, reply: 'Hi there!' });
  });

  it('sends a single-turn user message with the placeholder system prompt and the sonnet-5 model, stateless — no prior turns', async () => {
    const client = makeClient(TEXT_MESSAGE);

    await generateReply(client, { text: 'hello' });

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        system: PLACEHOLDER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    );
  });

  it('passes inline tool definitions through to the API call when provided, proving the client wiring supports them', async () => {
    const client = makeClient(TEXT_MESSAGE);
    const tools = [
      {
        name: 'noop',
        description: 'does nothing, proves the wiring',
        input_schema: { type: 'object' as const, properties: {} },
      },
    ];

    await generateReply(client, { text: 'hello', tools });

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ tools }),
    );
  });

  it('omits the tools key entirely when none are provided', async () => {
    const client = makeClient(TEXT_MESSAGE);

    await generateReply(client, { text: 'hello' });

    const call = client.messages.create.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect('tools' in call).toBe(false);
  });

  it('returns ok:false when the response has no text content block', async () => {
    const client = makeClient({
      content: [{ type: 'tool_use', id: 't1', name: 'x', input: {} }],
      stop_reason: 'tool_use',
    });

    const result = await generateReply(client, { text: 'hello' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('no-text-content');
    }
  });

  it('returns ok:false when the client throws a generic error (network failure, timeout, etc.)', async () => {
    const client = makeClient(() => {
      throw new Error('request timed out');
    });

    const result = await generateReply(client, { text: 'hello' });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'anthropic-api-error', message: 'request timed out' },
    });
  });

  it('handles a real RateLimitError the way @anthropic-ai/sdk actually throws it — verified against its source, status-prefixed message format', async () => {
    const client = makeClient(() => {
      throw new RateLimitError(
        429,
        { message: 'Rate limit exceeded' },
        undefined,
        new Headers(),
      );
    });

    const result = await generateReply(client, { text: 'hello' });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'anthropic-api-error',
        message: '429 Rate limit exceeded',
      },
    });
  });
});
