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
// runs. The prompt is a backstop, not the deploy authorisation: deploys stay Alex's to run (`AGENTS.md`).
//
// Deliberately a regular expression, not a shell tokenizer. It looks for `fly`/`flyctl` as a
// command word anywhere in the command (after `cd x &&`, `;`, `|`, inside `$(...)` or `sh -c '…'`),
// followed by the subcommand. The trade-off is intended: a false positive costs one prompt, so the
// regex leans towards asking.
// - Asks although nothing live changes: `echo "run fly deploy later"`, an argument that equals a
//   subcommand (`fly status -a deploy`), and `fly deploy --build-only`.
// - Doesn't ask (accepted false negatives; this is not a security boundary): a quoted command word
//   or subcommand (`"fly" deploy`, `fly "deploy"`), a `$(...)`, a backtick, a quoted `|`/`;`/`&` or
//   a backslash line break between `fly` and the subcommand, variable indirection
//   (`F=fly; $F deploy`), and a script file that runs the command (`bash deploy.sh`).
// - Doesn't ask, by design: read-only commands (`fly status`, `fly logs`, `fly secrets list`, a bare
//   `fly secrets`) and other binaries whose name merely ends in "fly" (`superfly`, `moe-fly`,
//   `moe.fly`).
//
// Fails open: non-Bash input, empty stdin or unparseable JSON exits 0 with no output, so the hook
// makes no decision and Claude Code's normal permission flow applies. A crashed hook (exit 1)
// doesn't block either. This is a guard against a mistaken agent action, not a security boundary.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

type FlyGuardKind = 'deploy' | 'secrets';

// `fly`/`flyctl` as a command word: not preceded by a word character, `-` or `.` (so `superfly`,
// `moe-fly` and `moe.fly` don't match) and followed by whitespace (so `fly.sarah.toml` doesn't
// match). `GAP` then spans the rest of that one command, stopping at `|`, `;`, `&`, a newline, `)`
// or a backtick, so flags before the subcommand (`fly --debug deploy`, `fly -a moe-sarah deploy`)
// still match.
const FLY = String.raw`(?<![\w.-])(?:fly|flyctl)\s+`;
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
    "This can ship a new image to a live persona Fly App (--build-only only builds and pushes). Deploys are Alex's call (docs/OPERATIONS.md §Deploying the persona fleet): confirm only if Alex asked for this one.",
  secrets:
    "This changes or deploys a live persona App's secrets. Unless run with --stage, it deploys them and restarts the App's Machines (`fly secrets deploy` always does), and a truncated or empty secret has taken the service down before. Confirm the App, and any values being set.",
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
