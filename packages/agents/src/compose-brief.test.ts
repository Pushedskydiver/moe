import { AnthropicError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { composeBrief } from './compose-brief.js';

function makeClient(
  parsedOutput: {
    readonly summary: string;
    readonly scope: readonly string[];
  } | null,
  usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_creation_input_tokens: number | null;
    readonly cache_read_input_tokens: number | null;
  } = {
    input_tokens: 120,
    output_tokens: 40,
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

describe('composeBrief', () => {
  it('returns ok:true with the composed summary, scope, and token usage from a title-only call', async () => {
    const client = makeClient({
      summary: 'The CLI silently drops rows over 10k on export.',
      scope: ['Reproduce the truncation', 'Fix the export pagination'],
    });

    const result = await composeBrief(client, {
      title: 'Export CLI drops rows over 10k',
    });

    expect(result).toEqual({
      ok: true,
      summary: 'The CLI silently drops rows over 10k on export.',
      scope: ['Reproduce the truncation', 'Fix the export pagination'],
      usage: { inputTokens: 120, outputTokens: 40 },
    });
  });

  it('sends both title and body as the user turn when body is given', async () => {
    const client = makeClient({
      summary: 'The CLI silently drops rows over 10k on export.',
      scope: ['Reproduce the truncation'],
    });

    await composeBrief(client, {
      title: 'Export CLI drops rows over 10k',
      body: 'Users report the CSV export truncates past 10,000 rows.',
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0]?.content).toContain(
      'Export CLI drops rows over 10k',
    );
    expect(call.messages[0]?.content).toContain(
      'Users report the CSV export truncates past 10,000 rows.',
    );
  });

  it('sends only the title when body is an empty (or whitespace-only) string, same as when body is absent', async () => {
    const client = makeClient({ summary: 'x', scope: ['y'] });

    await composeBrief(client, {
      title: 'Export CLI drops rows over 10k',
      body: '   ',
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).toBe('Export CLI drops rows over 10k');
  });

  it('sends only the title when body is a genuinely empty string (not just whitespace-only)', async () => {
    const client = makeClient({ summary: 'x', scope: ['y'] });

    await composeBrief(client, {
      title: 'Export CLI drops rows over 10k',
      body: '',
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).toBe('Export CLI drops rows over 10k');
  });

  it('uses the given model override instead of the sonnet-5 default when provided', async () => {
    const client = makeClient({ summary: 'x', scope: ['y'] });

    await composeBrief(client, {
      title: 'something needs doing',
      model: 'claude-opus-5',
    });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-5' }),
    );
  });

  it('defaults to the sonnet-5 model when no override is given', async () => {
    const client = makeClient({ summary: 'x', scope: ['y'] });

    await composeBrief(client, { title: 'something needs doing' });

    expect(client.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' }),
    );
  });

  it('prepends personaPromptContent ahead of the brief task instructions when given', async () => {
    const client = makeClient({ summary: 'x', scope: ['y'] });

    await composeBrief(client, {
      title: 'something needs doing',
      personaPromptContent: "You're Sarah, moe's PM.",
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(2);
    expect(call.system[0]?.text).toBe("You're Sarah, moe's PM.");
  });

  it('omits the persona block when personaPromptContent is not given', async () => {
    const client = makeClient({ summary: 'x', scope: ['y'] });

    await composeBrief(client, { title: 'something needs doing' });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: ReadonlyArray<{ readonly text: string }>;
    };
    expect(call.system).toHaveLength(1);
  });

  it('returns ok:false with kind no-parsed-output when parsed_output is null', async () => {
    const client = makeClient(null);

    const result = await composeBrief(client, { title: 'anything' });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'no-parsed-output',
        message: 'brief response had no parsed_output',
      },
    });
  });

  it('returns ok:false with kind anthropic-api-error when the client throws a generic error', async () => {
    const client = {
      messages: {
        parse: vi.fn().mockRejectedValue(new Error('request timed out')),
      },
    };

    const result = await composeBrief(client, { title: 'anything' });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'anthropic-api-error', message: 'request timed out' },
    });
  });

  it('returns ok:false with kind invalid-brief-output when zodOutputFormat throws a bare AnthropicError (schema/JSON-parse failure)', async () => {
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

    const result = await composeBrief(client, { title: 'anything' });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-brief-output',
        message: 'Failed to parse structured output: invalid JSON',
      },
    });
  });
});
