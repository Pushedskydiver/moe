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

  // BUILD_PLAN 3.12 — a real production bug: the classifier scored "is the auth work finished?"
  // as 75 (High band) and auto-drafted a ticket whose entire body was "someone asked whether the
  // auth work is finished." Root cause was the system prompt's own category definition ("a
  // question that needs someone to act"), not the thresholds. This pins the prompt-text fix
  // itself — the actual scoring behaviour is validated live against the real API (see
  // docs/decisions/STAGE-1-CLASSIFIER.md's 2026-08-01 addendum), which a mocked-client unit test
  // cannot do, but a mocked test *can* guard against this exact clause silently regressing back to
  // the pre-fix wording. Would fail against the pre-3.12 prompt: it lacks the first phrase below
  // entirely, and still contains the retired phrase the third assertion rules out.
  it('BUILD_PLAN 3.12 — the system prompt carves status-progress questions out of the actionable-work category', async () => {
    const client = makeClient({ confidence: 10, reasoning: 'status question' });

    await classifyMessageConfidence(client, {
      text: 'is the auth work finished?',
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: string;
    };
    expect(call.system).toContain('finished, done, or has happened yet');
    // The phrase above occurs twice — once in the prompt's summary sentence, once in its
    // elaboration paragraph (a schema pair: both must agree, or the model sees a narrower
    // distinction than either alone states). A bare `toContain` on the three-way phrase would
    // stay green even if just one of the two independently regressed back to its own pre-fix
    // two-way wording ("finished or has happened yet", no "done") — pin both directions
    // separately, by each occurrence's own surrounding punctuation, so this test actually
    // discriminates either half regressing on its own, not just both at once.
    expect(call.system).not.toContain('is finished or has happened yet.');
    expect(call.system).not.toContain('is *finished or has happened yet*');
    expect(call.system).not.toContain('a question that needs someone to act');
  });

  // A sibling regression case to the test above — BUILD_PLAN 3.12's fix rewrote the entire
  // negative-category disjunct list, and an earlier draft of that rewrite silently dropped the
  // pre-existing "commentary that doesn't need any action" arm (caught by review, not by any
  // test). This pins its presence directly so a future edit to this same clause list can't drop
  // it again without a test failing.
  it('BUILD_PLAN 3.12 — the system prompt still names non-actionable commentary as a negative case', async () => {
    const client = makeClient({ confidence: 5, reasoning: 'FYI commentary' });

    await classifyMessageConfidence(client, {
      text: 'the new hire starts Monday',
    });

    const call = client.messages.parse.mock.calls[0]?.[0] as {
      system: string;
    };
    expect(call.system).toContain("commentary that doesn't need any action");
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
