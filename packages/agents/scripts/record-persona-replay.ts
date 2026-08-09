// Imports this package's own BUILT output (../dist), same reasoning `packages/core/scripts/
// migrate.ts`'s own header comment documents — Node's native TypeScript execution doesn't resolve
// `.js` specifiers back to sibling `.ts` source for relative imports (only works once the `.js`
// file genuinely exists on disk). Requires `pnpm build` to have run first — the `record:replay`
// script does that automatically. Manual, live, deliberately not part of CI
// (`docs/decisions/PERSONA-REPLAY-HARNESS.md` decision 1) — run this after editing a persona's
// `prompt.md`, review the fixture diff it writes, then commit both together.
import type { PersonaId } from '../dist/index.js';
import type { ReplayFixture } from '../dist/persona-replay/replay-fixture.js';
import type { ReplayScenario } from '../dist/persona-replay/replay-scenario.js';
import type { Anthropic } from '@anthropic-ai/sdk';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPersonaSystemPrompt,
  composeConfirmingQuestionLeadIn,
  composeTicketDraft,
  createAnthropicClient,
  fetchPersonaPromptContent,
  generateReply,
  parseAnthropicConfig,
  resolvePersonaModel,
  STATUS_CLAIM_TOOL,
} from '../dist/index.js';
import { hashReplayContent } from '../dist/persona-replay/hash-replay-content.js';
import { saveReplayFixture } from '../dist/persona-replay/save-replay-fixture.js';
import { scenarios as marcusScenarios } from '../dist/personas/marcus/replay/scenarios.js';
import { scenarios as mayaScenarios } from '../dist/personas/maya/replay/scenarios.js';
import { scenarios as sarahScenarios } from '../dist/personas/sarah/replay/scenarios.js';

// One entry per backfilled persona, not a dynamic string-built import — explicit code over
// cleverness at this scale (`docs/decisions/PERSONA-REPLAY-HARNESS.md` decision 6). Extend this
// map the day a future 5.3 sub-chunk adds its own persona's scenarios.
const SCENARIOS_BY_PERSONA: Partial<
  Record<PersonaId, readonly ReplayScenario[]>
> = {
  sarah: sarahScenarios,
  maya: mayaScenarios,
  marcus: marcusScenarios,
};

// Minimal AppLogger — `createAnthropicClient` requires one to route the SDK's own internal
// logging through `createAnthropicSdkLoggerAdapter`'s value-based API-key redaction
// (`docs/CONVENTIONS.md` §External API Integration Patterns). `apps/server/src/logger.ts`'s real
// `createLogger` can't be reused here: `packages/agents` may not depend on `apps/server`
// (`eslint.config.ts`'s `boundaries/dependencies`).
const logger = {
  info: (message: string, fields?: Readonly<Record<string, unknown>>) =>
    console.log(JSON.stringify({ level: 'info', message, ...fields })),
  warn: (message: string, fields?: Readonly<Record<string, unknown>>) =>
    console.warn(JSON.stringify({ level: 'warn', message, ...fields })),
  error: (message: string, fields?: Readonly<Record<string, unknown>>) =>
    console.error(JSON.stringify({ level: 'error', message, ...fields })),
};

function isSupportedPersonaId(value: string | undefined): value is PersonaId {
  return value !== undefined && value in SCENARIOS_BY_PERSONA;
}

const personaArg = process.argv[2];
if (!isSupportedPersonaId(personaArg)) {
  console.error(
    `Usage: pnpm --filter @moe/agents record:replay -- <personaId>\n` +
      `Supported personas: ${Object.keys(SCENARIOS_BY_PERSONA).join(', ')}`,
  );
  process.exit(1);
}
const personaId: PersonaId = personaArg;
const scenarios = SCENARIOS_BY_PERSONA[personaId] ?? [];

const parsedAnthropic = parseAnthropicConfig(process.env);
if (!parsedAnthropic.ok) {
  console.error(
    'Invalid Anthropic config:',
    parsedAnthropic.error.issues.join(', '),
  );
  process.exit(1);
}

// A batch-recording script has no live-Slack-reply latency target, unlike every production call
// site — `createAnthropicClient`'s 20s default genuinely timed out live on a scenario that
// provoked heavy extended thinking (confirmed by running this exact script, not assumed).
const RECORDING_TIMEOUT_MS = 120_000;
const realClient = createAnthropicClient(
  parsedAnthropic.config.apiKey,
  logger,
  RECORDING_TIMEOUT_MS,
);

type RawCapture = {
  readonly stopReason: string | null;
  readonly outputTokensRaw: number | null;
};

type RecordingClient = {
  readonly messages: {
    readonly create: Anthropic['messages']['create'];
    readonly parse: Anthropic['messages']['parse'];
  };
};

/**
 * Recording-only wrapper (`docs/decisions/PERSONA-REPLAY-HARNESS.md` decision 4) — reads
 * `stop_reason`/`usage.output_tokens` off the raw SDK response alongside the real production
 * call, since neither field is exposed by `generateReply`/`composeTicketDraft`/
 * `composeConfirmingQuestionLeadIn`'s own `Result` types on every branch. Scenarios record
 * strictly one at a time (a plain `for...of`, never `Promise.all`), so a single last-capture slot
 * is safe — no risk of one scenario's capture being overwritten mid-flight by another.
 */
function wrapClientForRecording(client: Anthropic): {
  readonly client: RecordingClient;
  readonly getLastCapture: () => RawCapture | undefined;
} {
  let lastCapture: RawCapture | undefined;

  const capture = (message: {
    readonly stop_reason: string | null;
    readonly usage: { readonly output_tokens: number };
  }): void => {
    lastCapture = {
      stopReason: message.stop_reason,
      outputTokensRaw: message.usage.output_tokens,
    };
  };

  return {
    client: {
      messages: {
        // The real SDK's `create()` has overloaded signatures (streaming vs. non-streaming); this
        // wrapper only ever forwards `MessageCreateParamsNonStreaming` (all three cascade
        // functions do too), so the single-signature cast is narrowing to the one overload
        // actually used, not widening past what the real method supports.
        create: (async (
          params: Parameters<Anthropic['messages']['create']>[0],
        ) => {
          const message = await client.messages.create(params);
          capture(message);
          return message;
        }) as Anthropic['messages']['create'],
        // Same overload-narrowing reasoning as `create` above — `parse()`'s real generic return
        // type (`ParsedMessage<T>`) is inferred from `output_config.format`, which this wrapper
        // forwards opaquely; the cast asserts what's already true at every real call site
        // (`ParsedMessage<T> = Message & {...}`, confirmed against the installed SDK's own type
        // declarations, so `stop_reason`/`usage` are present regardless of `T`).
        parse: (async (
          params: Parameters<Anthropic['messages']['parse']>[0],
        ) => {
          const message = await client.messages.parse(params);
          capture(message);
          return message;
        }) as Anthropic['messages']['parse'],
      },
    },
    getLastCapture: () => lastCapture,
  };
}

type RecordOutcome =
  | { readonly fixture: ReplayFixture }
  | { readonly failed: true; readonly detail: string };

async function callForScenario(params: {
  readonly scenario: ReplayScenario;
  readonly client: RecordingClient;
  readonly promptContent: string;
  readonly model: string;
}) {
  const { scenario, client, promptContent, model } = params;

  if (scenario.callSite === 'dmReply') {
    return generateReply(client, {
      text: scenario.input.text,
      history: scenario.input.history,
      system: await buildPersonaSystemPrompt(personaId, logger),
      model,
      tools: [STATUS_CLAIM_TOOL],
    });
  }
  if (scenario.callSite === 'ticketDraft') {
    return composeTicketDraft(client, {
      text: scenario.input.text,
      model,
      personaPromptContent: promptContent,
    });
  }
  return composeConfirmingQuestionLeadIn(client, {
    text: scenario.input.text,
    confidence: scenario.input.confidence ?? 50,
    reasoning: scenario.input.reasoning ?? '',
    model,
    personaPromptContent: promptContent,
  });
}

async function recordScenario(params: {
  readonly scenario: ReplayScenario;
  readonly client: RecordingClient;
  readonly getLastCapture: () => RawCapture | undefined;
  readonly promptContent: string;
  readonly model: string;
}): Promise<RecordOutcome> {
  const { scenario, client, getLastCapture, promptContent, model } = params;

  const result = await callForScenario({
    scenario,
    client,
    promptContent,
    model,
  });
  const capture = getLastCapture();
  if (capture === undefined) {
    return {
      failed: true,
      detail: 'no raw response was captured — recording wrapper bug',
    };
  }

  // Refuse to write a failed or truncated recording (decision 8) — a committed fixture in either
  // state would fail replay verification forever, since verification never re-calls the network.
  if (!result.ok) {
    return {
      failed: true,
      detail: `${result.error.kind}: ${result.error.message}`,
    };
  }
  if (capture.stopReason === 'max_tokens') {
    return {
      failed: true,
      detail: `truncated (stop_reason=max_tokens, output_tokens=${capture.outputTokensRaw})`,
    };
  }

  return {
    fixture: {
      scenarioId: scenario.id,
      personaId,
      callSite: scenario.callSite,
      promptContentHash: hashReplayContent(promptContent),
      scenarioInputHash: hashReplayContent(JSON.stringify(scenario.input)),
      model,
      recordedAt: new Date().toISOString(),
      stopReason: capture.stopReason,
      outputTokensRaw: capture.outputTokensRaw,
      result,
    },
  };
}

if (scenarios.length === 0) {
  console.error(`No scenarios defined for "${personaId}".`);
  process.exit(1);
}

const promptContent =
  (await fetchPersonaPromptContent(personaId, logger)) ?? '';
const model = resolvePersonaModel(personaId);
const { client: recordingClient, getLastCapture } =
  wrapClientForRecording(realClient);
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'personas',
  personaId,
  'replay',
  'fixtures',
);

let failureCount = 0;
for (const scenario of scenarios) {
  console.log(`Recording "${scenario.id}" (${scenario.callSite})...`);
  const outcome = await recordScenario({
    scenario,
    client: recordingClient,
    getLastCapture,
    promptContent,
    model,
  });
  if ('failed' in outcome) {
    failureCount += 1;
    console.error(`  FAILED: ${outcome.detail}`);
    continue;
  }
  const path = join(fixturesDir, `${scenario.id}.json`);
  await saveReplayFixture(path, outcome.fixture);
  console.log(`  recorded -> ${path}`);
}

if (failureCount > 0) {
  console.error(
    `${failureCount} of ${scenarios.length} scenario(s) failed to record for "${personaId}" — ` +
      `see above. Fix and re-run before committing.`,
  );
  process.exit(1);
}
console.log(
  `All ${scenarios.length} scenario(s) for "${personaId}" recorded successfully.`,
);
