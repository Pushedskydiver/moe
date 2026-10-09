import type {
  EvalConfiguration,
  EvalConfigurationId,
} from './eval-configurations.js';
import type { ClassifierEvalSet, EvalSet, GateEvalSet } from './eval-sets.js';
import type { EvalCreateClient, RawCapture } from './recording-eval-client.js';
import type { ConfidenceBand } from '@moe/core';

import { classifyConfidenceBand } from '@moe/core';

import { classifyMessageConfidence } from '../classify-message-confidence.js';
import { evaluateSituationalAppropriateness } from '../evaluate-situational-appropriateness.js';
import { makeRecordingEvalClient } from './recording-eval-client.js';

type EvalTarget =
  | {
      readonly kind: 'classifier';
      readonly message: ClassifierEvalSet['messages'][number];
    }
  | {
      readonly kind: 'gate';
      readonly message: GateEvalSet['messages'][number];
    };

export type EvalCallSpec = {
  readonly index: number;
  readonly configuration: EvalConfiguration;
  readonly setId: string;
  readonly messageId: string;
  readonly run: number;
  readonly target: EvalTarget;
};

export type EvalCallOutcome =
  | {
      readonly ok: true;
      readonly kind: 'classifier';
      readonly confidence: number;
      readonly band: ConfidenceBand;
      readonly reasoning: string;
    }
  | {
      readonly ok: true;
      readonly kind: 'gate';
      readonly appropriate: boolean;
      readonly reasoning: string;
    }
  | {
      readonly ok: false;
      // The production function's own `error.kind`, never reclassified here.
      readonly errorKind: string;
      readonly errorMessage: string;
    };

export type EvalCallRecord = {
  readonly configurationId: EvalConfigurationId;
  readonly setId: string;
  readonly messageId: string;
  readonly run: number;
  readonly outcome: EvalCallOutcome;
  // `null` when the request itself failed and there was no response to record.
  readonly capture: RawCapture | null;
};

export type EvalResults = {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly runsPerMessage: number;
  readonly configurations: readonly EvalConfiguration[];
  readonly sets: readonly EvalSet[];
  readonly calls: readonly EvalCallRecord[];
};

function targetsOf(
  set: EvalSet,
): readonly { readonly id: string; readonly target: EvalTarget }[] {
  return set.kind === 'classifier'
    ? set.messages.map((message) => ({
        id: message.id,
        target: { kind: 'classifier', message },
      }))
    : set.messages.map((message) => ({
        id: message.id,
        target: { kind: 'gate', message },
      }));
}

/**
 * Every call a run makes, in the order it makes them: set, message and run, then every
 * configuration for that run, so a failure tied to a stretch of time (an outage, a burst of rate
 * limits) lands across all the configurations rather than on one. Pure, so the order and the
 * total are testable without a client.
 */
export function planEvalCalls(
  sets: readonly EvalSet[],
  configurations: readonly EvalConfiguration[],
  runsPerMessage: number,
): readonly EvalCallSpec[] {
  const runs = Array.from(
    { length: runsPerMessage },
    (_unused, position) => position + 1,
  );
  const specs = sets.flatMap((set) =>
    targetsOf(set).flatMap(({ id, target }) =>
      runs.flatMap((run) =>
        configurations.map((configuration) => ({
          configuration,
          setId: set.id,
          messageId: id,
          run,
          target,
        })),
      ),
    ),
  );

  return specs.map((spec, index) => ({ ...spec, index }));
}

async function callProductionFunction(
  client: ReturnType<typeof makeRecordingEvalClient>,
  target: EvalTarget,
): Promise<EvalCallOutcome> {
  if (target.kind === 'classifier') {
    const result = await classifyMessageConfidence(client, {
      text: target.message.text,
    });
    return result.ok
      ? {
          ok: true,
          kind: 'classifier',
          confidence: result.confidence,
          band: classifyConfidenceBand(result.confidence),
          reasoning: result.reasoning,
        }
      : {
          ok: false,
          errorKind: result.error.kind,
          errorMessage: result.error.message,
        };
  }

  const result = await evaluateSituationalAppropriateness(client, {
    text: target.message.text,
  });
  return result.ok
    ? {
        ok: true,
        kind: 'gate',
        appropriate: result.appropriate,
        reasoning: result.reasoning,
      }
    : {
        ok: false,
        errorKind: result.error.kind,
        errorMessage: result.error.message,
      };
}

async function runEvalCall(
  real: EvalCreateClient,
  spec: EvalCallSpec,
): Promise<EvalCallRecord> {
  // The wrapper reports at most one capture per call; resolving with `undefined` afterwards
  // settles the promise when the request failed before any response existed (a no-op otherwise).
  const capture = Promise.withResolvers<RawCapture | undefined>();
  const client = makeRecordingEvalClient(
    real,
    spec.configuration,
    capture.resolve,
  );
  const outcome = await callProductionFunction(client, spec.target);
  capture.resolve(undefined);

  return {
    configurationId: spec.configuration.id,
    setId: spec.setId,
    messageId: spec.messageId,
    run: spec.run,
    outcome,
    capture: (await capture.promise) ?? null,
  };
}

// Strictly one at a time: each call starts only once the previous one has finished.
async function mapSequentially<Item, Result>(
  items: readonly Item[],
  fn: (item: Item) => Promise<Result>,
): Promise<readonly Result[]> {
  const [head, ...rest] = items;
  if (head === undefined) return [];

  const first = await fn(head);
  return [first, ...(await mapSequentially(rest, fn))];
}

export type RunClassifierEvalOptions = {
  readonly client: EvalCreateClient;
  readonly sets: readonly EvalSet[];
  readonly configurations: readonly EvalConfiguration[];
  readonly runsPerMessage: number;
  // Called after each call, 1-based position of `total`, for progress output and persistence.
  // Awaited, so the next call starts only once it has finished.
  readonly onCall?: (
    record: EvalCallRecord,
    position: number,
    total: number,
  ) => Promise<void> | void;
};

/**
 * BUILD_PLAN 3.13: runs the production classifier and safety gate, unchanged, over every set
 * under every configuration, `runsPerMessage` times each, one call at a time. A failed call is
 * recorded (the production function's own error kind, plus any `stop_reason` the wrapper
 * captured) and the run goes on: one failure never aborts it. Makes live, billed calls through
 * whatever `client` is, so only the manual `eval:classifiers` script passes it a real one.
 */
export async function runClassifierEval(
  options: RunClassifierEvalOptions,
): Promise<EvalResults> {
  const { client, sets, configurations, runsPerMessage, onCall } = options;
  const startedAt = new Date().toISOString();
  const plan = planEvalCalls(sets, configurations, runsPerMessage);

  const calls = await mapSequentially(plan, async (spec) => {
    const record = await runEvalCall(client, spec);
    await onCall?.(record, spec.index + 1, plan.length);
    return record;
  });

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    runsPerMessage,
    configurations,
    sets,
    calls,
  };
}
