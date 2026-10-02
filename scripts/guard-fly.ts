// PreToolUse hook (`.claude/settings.json`, Bash matcher). Makes an agent's `fly deploy`, mutating
// `fly secrets` command (`set`, `unset`, `import`, `deploy`, `sync`) or deploy-equivalent hit an
// ordinary confirmation prompt instead of running silently. Four kinds ask:
// - `deploy`: `fly deploy`.
// - `secrets`: mutating `fly secrets` commands.
// - `machines`: `fly machine update` (every form), `fly machine clone`, `fly image update` and
//   `fly scale count`, which change or add Machines on a live App without `fly deploy`.
// - `destroy`: `fly apps destroy` (and its aliases `delete`, `remove`, `rm`) and the deprecated
//   `fly destroy`. The regex lets words sit between `fly` and `destroy`, so `fly machine destroy`
//   and `fly volumes destroy` ask too: they delete live resources as well.
//
// Exists because deploys are Alex's call and deliberately not automated: a truncated or empty
// secret has taken the live service down before (`docs/GIT.md` §Deploy Flow, `docs/OPERATIONS.md`
// §Deploying the persona fleet), and until this hook nothing mechanical stopped an agent session
// from running these commands itself. It has to be PreToolUse, not PostToolUse: a PostToolUse hook
// can only react after the deploy or the secret change has already happened, whereas a PreToolUse
// hook can emit `permissionDecision: "ask"` and turn the command into a confirmation before it
// runs. The prompt is a backstop, not the authorisation: an agent runs a deploy only when Alex
// explicitly asks for it in chat, never on its own initiative (`AGENTS.md` §Commands).
//
// Deliberately a regular expression, not a shell tokenizer. It looks for `fly`/`flyctl` as a
// command word anywhere in the command (after `cd x &&`, `;`, `|`, inside `$(...)` or `sh -c '…'`),
// followed by the subcommand. The trade-off is intended: a false positive costs one prompt, so the
// regex leans towards asking.
// - Asks although nothing live changes: `echo "run fly deploy later"`, an argument that equals a
//   subcommand (`fly status -a deploy`), and `fly deploy --build-only`.
// - Doesn't ask (accepted false negatives; this is not a security boundary): a quoted command word
//   or subcommand (`"fly" deploy`, `fly "deploy"`), a `$(...)`, a backtick, a quoted `|`/`;`/`&`
//   between `fly` and the subcommand, a backslash line break followed by an indented line, an
//   uppercase `FLY` (which macOS's case-insensitive filesystem still runs), variable indirection
//   (`F=fly; $F deploy`), and a script file that runs the command (`bash deploy.sh`).
// - Doesn't ask, by design: read-only commands (`fly status`, `fly logs`, `fly secrets list`, a bare
//   `fly secrets`, `fly scale show`, `fly machine list`, `fly apps list`), other mutating `fly`
//   commands outside the list above (`fly scale vm`, `fly machine stop`: the list is deploys,
//   secrets and the deploy-equivalents Alex named, not every mutation), and binaries whose name
//   ends in "fly" straight after a letter, digit, `_`, `-` or `.` (`superfly`, `moe-fly`,
//   `moe.fly`). Other prefixes, such as `moe+fly`, still ask.
//
// Fails open: non-Bash input, empty stdin or unparseable JSON exits 0 with no output, so the hook
// makes no decision and Claude Code's normal permission flow applies. A crashed hook (exit 1)
// doesn't block either. This is a guard against a mistaken agent action, not a security boundary.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

type FlyGuardKind = 'deploy' | 'secrets' | 'machines' | 'destroy';

// `fly`/`flyctl` as a command word: not preceded by a word character, `-` or `.` (so `superfly`,
// `moe-fly` and `moe.fly` don't match) and followed by whitespace (so `fly.sarah.toml` doesn't
// match). `GAP` then spans the rest of that one command, stopping at `|`, `;`, `&`, a newline, `)`
// or a backtick, so flags before the subcommand (`fly --debug deploy`, `fly -a moe-sarah deploy`)
// still match. The whitespace at the end of `FLY` and `GAP` can itself be a newline, so an
// unindented next line still counts (`fly status` then `deploy` on the next line asks).
const FLY = String.raw`(?<![\w.-])(?:fly|flyctl)\s+`;
const GAP = String.raw`(?:[^|;&\n)\x60]*?\s)?`;
const DEPLOY_PATTERN = new RegExp(String.raw`${FLY}${GAP}deploy(?![\w-])`, 'u');
const SECRETS_PATTERN = new RegExp(
  String.raw`${FLY}${GAP}secrets\s+${GAP}(?:set|unset|import|deploy|sync)(?![\w-])`,
  'u',
);

// Deploy-equivalents: they change or add Machines on a live App without `fly deploy`. Every
// `machine update` form asks, not only with `--image`: it still rewrites a live Machine's config.
const MACHINES_PATTERN = new RegExp(
  String.raw`${FLY}${GAP}(?:(?:machines?|m)\s+${GAP}(?:update|clone)|(?:image|img)\s+${GAP}update|scale\s+${GAP}count)(?![\w-])`,
  'u',
);

// `destroy` also matches `fly machine destroy` and `fly volumes destroy` (GAP spans the words
// before it): they delete live resources too. `apps` takes the aliases `delete`, `remove` and `rm`.
const DESTROY_PATTERN = new RegExp(
  String.raw`${FLY}${GAP}(?:apps?\s+${GAP}(?:delete|remove|rm)|destroy)(?![\w-])`,
  'u',
);

// Check order: `secrets` first so `fly secrets deploy` gets the secrets reason, not the image one;
// `destroy` and `machines` before `deploy` so a Machines or destroy command gets its own reason.
export function classifyFly(command: string): FlyGuardKind | null {
  if (SECRETS_PATTERN.test(command)) {
    return 'secrets';
  }
  if (DESTROY_PATTERN.test(command)) {
    return 'destroy';
  }
  if (MACHINES_PATTERN.test(command)) {
    return 'machines';
  }
  if (DEPLOY_PATTERN.test(command)) {
    return 'deploy';
  }
  return null;
}

const REASONS: Record<FlyGuardKind, string> = {
  deploy:
    "This can ship a new image to a live persona Fly App (with --build-only it builds without deploying). Deploys are Alex's call (docs/OPERATIONS.md §Deploying the persona fleet): confirm only if Alex asked for this one.",
  machines:
    "This changes a live persona App's Machines. `fly image update` does a rolling restart of each Machine, which may briefly disrupt service, and `fly machine update` changes a Machine's image or config. `fly machine clone` and `fly scale count` change how many Machines the App has, and a second Machine puts two processes on one persona's Slack connection. These are deploy-equivalents, and deploys are Alex's call (docs/OPERATIONS.md §Deploying the persona fleet): confirm only if Alex asked for this one.",
  destroy:
    "This deletes live Fly resources: `fly apps destroy` (or the deprecated `fly destroy`) removes a whole persona App from the Fly platform, `fly machine destroy` destroys Machines, and `fly volumes destroy` permanently deletes a volume's data. Confirm only if Alex asked for this one, and check the App or resource named.",
  secrets:
    "This changes or deploys a live persona App's secrets. Unless run with --stage, it deploys them and restarts the App's Machines (`fly secrets deploy` always does), and a truncated or empty secret has taken the service down before. Secret changes are Alex's call: confirm only if Alex asked for this one, and check the App and any values being set.",
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
