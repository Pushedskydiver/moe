import { AnthropicError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { composeTicketDraft } from './compose-ticket-draft.js';

function makeClient(
  parsedOutput: { readonly title: string; readonly body: string } | null,
  usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_creation_input_tokens?: number | null;
    readonly cache_read_input_tokens?: number | null;
  } = {
    input_tokens: 120,
    output_tokens: 40,
  },
) {
  return {
    messages: {
      parse: vi.fn().mockResolvedValue({ parsed_output: parsedOutput, usage }),
    },
  };
}

describe('composeTicketDraft', () => {
  it('returns ok:true with the drafted title, body, and token usage on a successful parse', async () => {
    const client = makeClient({
      title: 'CLI hangs on large repos',
      body: 'The CLI hangs when run against large repos.',
    });

    const result = await composeTicketDraft(client, {
      text: 'hey, there is an issue on the repo about the CLI hanging on large repos — someone want to take a look?',
    });

    expect(result).toEqual({
      ok: true,
      title: 'CLI hangs on large repos',
      body: 'The CLI hangs when run against large repos.',
      usage: { inputTokens: 120, outputTokens: 40 },
    });
  });

  it('surfaces cache_creation/cache_read token counts when the response carries them (BUILD_PLAN 5.3a-ii)', async () => {
    const client = makeClient(
      { title: 'x', body: 'y' },
      {
        input_tokens: 40,
        output_tokens: 12,
        cache_creation_input_tokens: 900,
        cache_read_input_tokens: 0,
      },
    );

    const result = await composeTicketDraft(client, { text: 'anything' });

    expect(result.ok && result.usage).toEqual({
      inputTokens: 40,
      outputTokens: 12,
      cacheCreationInputTokens: 900,
      cacheReadInputTokens: 0,
    });
  });

  it('sends the message as a single user turn with the Sonnet-5 model, as a cached system-block array with a cache_control marker', async () => {
    const client = makeClient({ title: 'x', body: 'y' });

    await composeTicketDraft(client, { text: 'something needs doing' });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'something needs doing' }],
      }),
    );
    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{
        readonly text: string;
        readonly cache_control?: unknown;
      }>;
    };
    expect(Array.isArray(call.system)).toBe(true);
    expect(call.system.at(-1)?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('uses the given model override instead of the sonnet-5 default when provided', async () => {
    const client = makeClient({ title: 'x', body: 'y' });

    await composeTicketDraft(client, {
      text: 'something needs doing',
      model: 'claude-opus-5',
    });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-5' }),
    );
  });

  it('prepends personaPromptContent ahead of the draft task instructions when given', async () => {
    const client = makeClient({ title: 'x', body: 'y' });

    await composeTicketDraft(client, {
      text: 'something needs doing',
      personaPromptContent: "You're Sarah, moe's PM.",
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(2);
    expect(call.system[0]?.text).toBe("You're Sarah, moe's PM.");
    expect(call.system[1]?.text).toContain(
      'You compose a short work-ticket draft',
    );
  });

  it('omits the persona block (unchanged from before this chunk) when personaPromptContent is not given', async () => {
    const client = makeClient({ title: 'x', body: 'y' });

    await composeTicketDraft(client, { text: 'something needs doing' });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(1);
    expect(call.system[0]?.text).toContain(
      'You compose a short work-ticket draft',
    );
  });

  it('returns ok:false with kind no-parsed-output when parsed_output is null', async () => {
    const client = makeClient(null);

    const result = await composeTicketDraft(client, { text: 'anything' });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'no-parsed-output',
        message: 'ticket-draft response had no parsed_output',
      },
    });
  });

  it('returns ok:false with kind anthropic-api-error when the client throws a generic error', async () => {
    const client = {
      messages: {
        parse: vi.fn().mockRejectedValue(new Error('request timed out')),
      },
    };

    const result = await composeTicketDraft(client, { text: 'anything' });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'anthropic-api-error', message: 'request timed out' },
    });
  });

  it('returns ok:false with kind invalid-draft-output when zodOutputFormat throws a bare AnthropicError (schema/JSON-parse failure)', async () => {
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

    const result = await composeTicketDraft(client, { text: 'anything' });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-draft-output',
        message: 'Failed to parse structured output: invalid JSON',
      },
    });
  });
});
