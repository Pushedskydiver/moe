// PreToolUse hook (`.claude/settings.json`, Bash matcher). Makes an agent's `fly deploy` or
// mutating `fly secrets` command (`set`, `unset`, `import`, `deploy`, `sync`) hit an ordinary
// confirmation prompt instead of running silently.
//
// Exists because deploys are Alex-only and deliberately not automated: a truncated or empty secret
// has taken the live service down before (`docs/GIT.md` §Deploy Flow, `docs/OPERATIONS.md`
// §Deploying the persona fleet), and until this hook nothing mechanical stopped an agent session
// from running either command itself. It has to be PreToolUse, not PostToolUse: a PostToolUse hook
// can only react after the deploy or the secret change has already happened, whereas a PreToolUse
// hook can emit `permissionDecision: "ask"` and turn the command into a confirmation before it
// runs. The human who confirms that prompt is the deploy authorisation.
//
// Deliberately a regular expression, not a shell tokenizer. It looks for `fly`/`flyctl` as a
// command word anywhere in the command (after `cd x &&`, `;`, `|`, inside `$(...)`), followed by
// the subcommand. That means `echo "run fly deploy later"` also asks. The trade-off is intended: a
// false positive costs one prompt, while a false negative is exactly the failure this hook exists
// to stop. Read-only commands (`fly status`, `fly logs`, `fly secrets list`, a bare `fly secrets`)
// and other binaries that merely end in "fly" (`superfly`, `moe-fly`) do not ask.
//
// Fails open: non-Bash input, empty stdin or unparseable JSON exits 0 with no output, so the
// command proceeds. A crashed hook doesn't block either. This is a guard against a mistaken agent
// action, not a security boundary.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type FlyGuardKind = 'deploy' | 'secrets';

// `fly`/`flyctl` as a command word: not preceded by a word character or `-` (so `superfly` and
// `moe-fly` don't match) and followed by whitespace (so `fly.sarah.toml` doesn't match). `GAP`
// then spans the rest of that one command up to a shell separator, so global flags before the
// subcommand (`fly -a moe-sarah deploy`) still match.
const FLY = String.raw`(?<![\w-])(?:fly|flyctl)\s+`;
const GAP = String.raw`(?:[^|;&\n)\x60]*?\s)?`;
const DEPLOY_PATTERN = new RegExp(String.raw`${FLY}${GAP}deploy(?![\w-])`, 'u');
const SECRETS_PATTERN = new RegExp(
  String.raw`${FLY}${GAP}secrets\s+${GAP}(?:set|unset|import|deploy|sync)(?![\w-])`,
  'u',
);

// `secrets` is checked first so `fly secrets deploy` gets the secrets reason, not the image one.
export function classifyFly(command: string): FlyGuardKind | null {
  if (SECRETS_PATTERN.test(command)) {
    return 'secrets';
  }
  if (DEPLOY_PATTERN.test(command)) {
    return 'deploy';
  }
  return null;
}

const REASONS: Record<FlyGuardKind, string> = {
  deploy:
    "This ships a new image to a live persona Fly App, which is Alex's call (docs/OPERATIONS.md §Deploying the persona fleet). Confirm only if he has asked for this deploy.",
  secrets:
    "This changes a live persona App's secrets (without --stage, `fly secrets set` also restarts its Machines), and a truncated or empty secret has taken the service down before. Confirm the App and the values.",
};

export function evaluateCommand(
  command: string,
): { ask: true; reason: string } | { ask: false } {
  const kind = classifyFly(command);
  if (kind === null) {
    return { ask: false };
  }
  return { ask: true, reason: REASONS[kind] };
}

type HookInput = { tool_name?: string; tool_input?: { command?: unknown } };

function main(): void {
  const stdinText = readFileSync(0, 'utf8');
  if (stdinText.trim().length === 0) {
    return;
  }
  let hookInput: HookInput;
  try {
    hookInput = JSON.parse(stdinText) as HookInput;
  } catch {
    return;
  }
  if (hookInput.tool_name !== 'Bash') {
    return;
  }
  const command = hookInput.tool_input?.command;
  if (typeof command !== 'string') {
    return;
  }

  const result = evaluateCommand(command);
  if (!result.ask) {
    return;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: result.reason,
      },
    }),
  );
}

const entryPoint = process.argv[1];
if (
  entryPoint !== undefined &&
  import.meta.url === pathToFileURL(entryPoint).href
) {
  main();
}
