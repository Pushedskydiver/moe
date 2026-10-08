import type { EvalSet } from './eval-sets.js';
import type { Anthropic } from '@anthropic-ai/sdk';

import { APIConnectionError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { EVAL_CONFIGURATIONS } from './eval-configurations.js';
import { planEvalCalls, runClassifierEval } from './run-eval.js';

const classifierSet: EvalSet = {
  id: 'classifier-set',
  kind: 'classifier',
  description: 'd',
  messages: [
    { id: 'c1', label: 'work', text: 'fix the build', expectedBands: ['high'] },
    { id: 'c2', label: 'banter', text: 'lol', expectedBands: ['low'] },
  ],
};

const gateSet: EvalSet = {
  id: 'gate-set',
  kind: 'gate',
  description: 'd',
  messages: [
    {
      id: 'g1',
      label: 'death',
      text: 'a colleague died',
      expectedAppropriate: false,
    },
  ],
};

function makeMessage(
  text: string | null,
  stopReason: Anthropic.Message['stop_reason'] = 'end_turn',
): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5',
    container: null,
    content: text === null ? [] : [{ type: 'text', text, citations: null }],
    stop_details: null,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 100,
      output_tokens: 20,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

function userText(params: Anthropic.MessageCreateParamsNonStreaming): string {
  const content = params.messages[0]?.content;
  return typeof content === 'string' ? content : '';
}

// A fake create that answers by what the production prompt asked: a score for the classifier,
// a verdict for the gate, so one fake serves both call sites.
function answerFor(params: Anthropic.MessageCreateParamsNonStreaming): string {
  return typeof params.system === 'string' &&
    params.system.includes('safety check')
    ? JSON.stringify({ appropriate: false, reasoning: 'sensitive' })
    : JSON.stringify({ confidence: 85, reasoning: 'work' });
}

describe('planEvalCalls', () => {
  it('plans set, message and run, then every configuration for that run, numbering each call', () => {
    const plan = planEvalCalls(
      [classifierSet, gateSet],
      EVAL_CONFIGURATIONS,
      3,
    );

    expect(plan).toHaveLength(4 * 3 * 3);
    expect(
      plan
        .slice(0, 6)
        .map((call) => [
          call.configuration.id,
          call.setId,
          call.messageId,
          call.run,
        ]),
    ).toEqual([
      ['A', 'classifier-set', 'c1', 1],
      ['B', 'classifier-set', 'c1', 1],
      ['C', 'classifier-set', 'c1', 1],
      ['D', 'classifier-set', 'c1', 1],
      ['A', 'classifier-set', 'c1', 2],
      ['B', 'classifier-set', 'c1', 2],
    ]);
    expect(
      [plan[12], plan[24]].map((call) => [call?.setId, call?.messageId]),
    ).toEqual([
      ['classifier-set', 'c2'],
      ['gate-set', 'g1'],
    ]);
    expect(plan.map((call) => call.index)).toEqual(
      plan.map((_call, position) => position),
    );
  });
});

describe('runClassifierEval', () => {
  it('records each classifier call with its score, band, reasoning and raw capture', async () => {
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) =>
        makeMessage(answerFor(params)),
    );

    const results = await runClassifierEval({
      client: { messages: { create } },
      sets: [classifierSet],
      configurations: [EVAL_CONFIGURATIONS[0]],
      runsPerMessage: 1,
    });

    expect(results.calls[0]).toEqual({
      configurationId: 'A',
      setId: 'classifier-set',
      messageId: 'c1',
      run: 1,
      outcome: {
        ok: true,
        kind: 'classifier',
        confidence: 85,
        band: 'high',
        reasoning: 'work',
      },
      capture: {
        stopReason: 'end_turn',
        stopDetails: null,
        contentBlockTypes: ['text'],
        usage: { inputTokens: 100, outputTokens: 20, thinkingTokens: null },
      },
    });
  });

  it("bands a score with core's thresholds: 70 is High, 69 and 35 are Mid, 34 is Low", async () => {
    const scores = [70, 69, 35, 34];
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) =>
        makeMessage(
          JSON.stringify({
            confidence: scores[create.mock.calls.length - 1],
            reasoning: userText(params),
          }),
        ),
    );

    const results = await runClassifierEval({
      client: { messages: { create } },
      sets: [classifierSet],
      configurations: [EVAL_CONFIGURATIONS[0]],
      runsPerMessage: 2,
    });

    expect(
      results.calls.map(
        (call) =>
          call.outcome.ok &&
          call.outcome.kind === 'classifier' &&
          call.outcome.band,
      ),
    ).toEqual(['high', 'mid', 'mid', 'low']);
  });

  it('records a gate call with its verdict', async () => {
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) =>
        makeMessage(answerFor(params)),
    );

    const results = await runClassifierEval({
      client: { messages: { create } },
      sets: [gateSet],
      configurations: [EVAL_CONFIGURATIONS[0]],
      runsPerMessage: 1,
    });

    expect(results.calls[0]?.outcome).toEqual({
      ok: true,
      kind: 'gate',
      appropriate: false,
      reasoning: 'sensitive',
    });
  });

  it("sends each configuration's own model and max_tokens to the API", async () => {
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) =>
        makeMessage(answerFor(params)),
    );

    await runClassifierEval({
      client: { messages: { create } },
      sets: [gateSet],
      configurations: EVAL_CONFIGURATIONS,
      runsPerMessage: 1,
    });

    expect(
      create.mock.calls.map(([params]) => [
        params.model,
        params.max_tokens,
        params.output_config?.effort,
      ]),
    ).toEqual([
      ['claude-haiku-4-5', 256, undefined],
      ['claude-haiku-5-5', 256, undefined],
      ['claude-haiku-5-5', 256, 'low'],
      ['claude-haiku-5-5', 1024, undefined],
    ]);
  });

  it('runs the calls one at a time, never two in flight', async () => {
    const inFlight = { now: 0, max: 0 };
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) => {
        inFlight.now += 1;
        inFlight.max = Math.max(inFlight.max, inFlight.now);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight.now -= 1;
        return makeMessage(answerFor(params));
      },
    );

    await runClassifierEval({
      client: { messages: { create } },
      sets: [classifierSet, gateSet],
      configurations: EVAL_CONFIGURATIONS.slice(0, 2),
      runsPerMessage: 2,
    });

    expect(create).toHaveBeenCalledTimes(2 * 3 * 2);
    expect(inFlight.max).toBe(1);
  });

  it('records a failed call with its error kind and goes on to the next one', async () => {
    const create = vi
      .fn<
        (
          params: Anthropic.MessageCreateParamsNonStreaming,
        ) => Promise<Anthropic.Message>
      >()
      .mockRejectedValueOnce(new APIConnectionError({ message: 'timed out' }))
      .mockImplementation(async (params) => makeMessage(answerFor(params)));

    const results = await runClassifierEval({
      client: { messages: { create } },
      sets: [classifierSet],
      configurations: [EVAL_CONFIGURATIONS[0]],
      runsPerMessage: 1,
    });

    expect(results.calls).toHaveLength(2);
    expect(results.calls[0]).toMatchObject({
      messageId: 'c1',
      outcome: { ok: false, errorKind: 'anthropic-api-error' },
      capture: null,
    });
    expect(results.calls[1]?.outcome.ok).toBe(true);
  });

  it("records a cut response's stop_reason beside the production function's no-parsed-output failure", async () => {
    const create = vi.fn(async () => makeMessage(null, 'max_tokens'));

    const results = await runClassifierEval({
      client: { messages: { create } },
      sets: [classifierSet],
      configurations: [EVAL_CONFIGURATIONS[1]],
      runsPerMessage: 1,
    });

    expect(results.calls[0]).toMatchObject({
      outcome: { ok: false, errorKind: 'no-parsed-output' },
      capture: { stopReason: 'max_tokens', contentBlockTypes: [] },
    });
  });

  it('reports each finished call to onCall with its position and the total', async () => {
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) =>
        makeMessage(answerFor(params)),
    );
    const onCall = vi.fn();

    await runClassifierEval({
      client: { messages: { create } },
      sets: [classifierSet],
      configurations: [EVAL_CONFIGURATIONS[0]],
      runsPerMessage: 1,
      onCall,
    });

    expect(
      onCall.mock.calls.map(([, position, total]) => [position, total]),
    ).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('waits for onCall to finish before it starts the next call', async () => {
    const events: string[] = [];
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) => {
        events.push('call');
        return makeMessage(answerFor(params));
      },
    );

    await runClassifierEval({
      client: { messages: { create } },
      sets: [classifierSet],
      configurations: [EVAL_CONFIGURATIONS[0]],
      runsPerMessage: 1,
      onCall: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push('persisted');
      },
    });

    expect(events).toEqual(['call', 'persisted', 'call', 'persisted']);
  });

  it('echoes the sets, configurations and run count into the results, so the results file is self-contained', async () => {
    const create = vi.fn(
      async (params: Anthropic.MessageCreateParamsNonStreaming) =>
        makeMessage(answerFor(params)),
    );

    const results = await runClassifierEval({
      client: { messages: { create } },
      sets: [gateSet],
      configurations: [EVAL_CONFIGURATIONS[0]],
      runsPerMessage: 1,
    });

    expect(results.sets).toEqual([gateSet]);
    expect(results.configurations).toEqual([EVAL_CONFIGURATIONS[0]]);
    expect(results.runsPerMessage).toBe(1);
  });
});
