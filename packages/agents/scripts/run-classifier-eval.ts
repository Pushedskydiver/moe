// Imports this package's own BUILT output (../dist), for the same reason `record-persona-replay.ts`
// does (see its header): Node's native TypeScript execution doesn't resolve `.js` specifiers back
// to sibling `.ts` source. Requires `pnpm build` to have run first — the `eval:classifiers` script
// does that automatically. Manual, live, deliberately not part of CI, like `record:replay`
// (`docs/decisions/PERSONA-REPLAY-HARNESS.md` decision 1): it makes one billed call per message,
// configuration and run against the real Anthropic API (BUILD_PLAN 3.13), one at a time, so it
// needs `ANTHROPIC_API_KEY` in the environment (read through `parseAnthropicConfig`, as
// `record-persona-replay.ts` does). Run it after a Haiku model change or a classifier or
// safety-gate prompt edit, then commit the results it writes beside the sets, in
// `classifier-eval/results/`. A run cut short leaves its finished calls in a `.partial.jsonl` file
// there, which git ignores.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeClassifierEval } from '../dist/classifier-eval/execute-classifier-eval.js';
import { createAnthropicClient, parseAnthropicConfig } from '../dist/index.js';

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

const parsedAnthropic = parseAnthropicConfig(process.env);
if (!parsedAnthropic.ok) {
  console.error(
    'Invalid Anthropic config:',
    parsedAnthropic.error.issues.join(', '),
  );
  process.exit(1);
}

// No third argument: the client keeps `createAnthropicClient`'s default timeout, the one
// production's Slack listener uses (`apps/server/src/start-slack-listener.ts`), so the eval sees
// production's own timeouts. A timeout is recorded like any other failure.
const client = createAnthropicClient(parsedAnthropic.config.apiKey, logger);

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = await executeClassifierEval({
  client,
  setsDir: join(packageRoot, 'classifier-eval', 'sets'),
  resultsDir: join(packageRoot, 'classifier-eval', 'results'),
  log: (line) => console.log(line),
});

if (!result.ok) {
  console.error(`Could not load the eval sets: ${result.error.message}`);
  process.exit(1);
}
console.log(`Results written to ${result.jsonPath} and ${result.markdownPath}`);
