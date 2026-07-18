import { AnthropicError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { composeTicketDraft } from './compose-ticket-draft.js';

function makeClient(
  parsedOutput: { readonly title: string; readonly body: string } | null,
  usage: { readonly input_tokens: number; readonly output_tokens: number } = {
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

  it('sends the message as a single user turn with the Sonnet-5 model and the draft system prompt', async () => {
    const client = makeClient({ title: 'x', body: 'y' });

    await composeTicketDraft(client, { text: 'something needs doing' });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'something needs doing' }],
      }),
    );
    const call = client.messages.parse.mock.calls[0]?.[0] as { system: string };
    expect(call.system.length).toBeGreaterThan(0);
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
