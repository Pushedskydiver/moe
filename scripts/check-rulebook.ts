// Validates the single-rulebook shape: `CLAUDE.md` is a thin `@AGENTS.md` stub, and every
// `.claude/rules/**/*.md` file carries a well-formed `paths:` glob and a real body. Run by CI's
// "Agent frontmatter" job (`pnpm check:rulebook`); see docs/decisions/SINGLE-RULEBOOK.md.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, matchesGlob as nodeMatchesGlob } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractFrontmatter } from './check-agent-frontmatter.ts';

// Up to 3 spaces of indent, then 3+ backticks or 3+ tildes: the CommonMark fence-open shape.
// Rejected outright rather than tracked open/closed — a stub that contains any fenced code block
// at all is already off-shape for a 10-line, one-import file.
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/u;
const IMPORT_LINE = '@AGENTS.md';

export function checkClaudeStub(
  claudeText: string,
  agentsMdExists: boolean,
): string[] {
  const errors: string[] = [];
  if (!agentsMdExists) errors.push('AGENTS.md does not exist');

  if (claudeText.includes('\r')) {
    errors.push('CLAUDE.md stub uses CRLF line endings, expected LF');
  }

  let hasFence = false;
  let importLineCount = 0;
  let nonEmptyCount = 0;

  for (const line of claudeText.split('\n')) {
    if (line.trim() !== '') nonEmptyCount++;
    if (FENCE_OPEN.test(line)) hasFence = true;
    // Policy, not a Claude Code limit: Claude Code imports any whitespace-preceded @path outside
    // code spans/blocks, but the stub keeps its one import on its own unindented line so this
    // check can find it.
    if (line === IMPORT_LINE) importLineCount++;
  }

  if (hasFence) {
    errors.push('`CLAUDE.md` stub must not contain a fenced code block');
  }

  if (importLineCount === 0) {
    errors.push(
      'no `@AGENTS.md` import line found (outside any fenced code block, unindented)',
    );
  } else if (importLineCount > 1) {
    errors.push(
      `\`@AGENTS.md\` import line appears ${importLineCount} times, expected exactly once`,
    );
  }

  // The cap is what stops rules creeping back into the stub — a low, deliberately arbitrary
  // ceiling rather than a measured budget.
  if (nonEmptyCount > 10) {
    errors.push(`has ${nonEmptyCount} non-empty lines, expected at most 10`);
  }

  return errors;
}

type ParsedRuleFrontmatter = {
  readonly globs: readonly string[];
  readonly errors: readonly string[];
};

const TOP_LEVEL_KEY_LINE = /^([\w-]+):(.*)$/u;
const RULE_ENTRY_LINE = /^ {2}- (.*)$/u;
const QUOTED_ENTRY = /^(['"])(.*)\1$/u;

// Deliberately not a YAML parser (same reasoning as check-agent-frontmatter.ts's own
// parseFrontmatter): every rule file uses exactly one shape, `paths:` followed by a block list of
// quoted glob strings, and that is the only shape this reads. A `paths` entry must be quoted
// (single or double): YAML reads a bare entry starting `*` as an alias — a parse error, so Claude
// Code drops the frontmatter and loads the rule unscoped — and one starting `{`/`[` as a mapping or
// sequence rather than a string; quoting every entry avoids both. An entry containing `[` is
// rejected outright even when quoted: Claude Code's own glob matcher and Node's `path.matchesGlob`
// disagree on POSIX bracket character classes, and no rule file actually needs one.
export function parseRuleFrontmatter(
  frontmatterText: string,
): ParsedRuleFrontmatter {
  const contentLines = frontmatterText
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'));

  if (contentLines.length === 0) {
    return { globs: [], errors: ['no `paths` key found'] };
  }

  const [firstLine, ...rest] = contentLines;
  const keyMatch =
    firstLine === undefined ? null : TOP_LEVEL_KEY_LINE.exec(firstLine);

  if (!keyMatch) {
    return {
      globs: [],
      errors: [`unparseable line "${firstLine ?? ''}" — expected \`paths:\``],
    };
  }

  const [, key = '', rawValue = ''] = keyMatch;
  if (key !== 'paths') {
    return {
      globs: [],
      errors: [`unknown key "${key}" — the only allowed key is \`paths\``],
    };
  }

  if (rawValue.trim() !== '') {
    return {
      globs: [],
      errors: [
        "paths must be a YAML block list (one glob per `  - '...'` line), not an inline or scalar value",
      ],
    };
  }

  const globs: string[] = [];
  const errors: string[] = [];

  for (const line of rest) {
    const extraKey = TOP_LEVEL_KEY_LINE.exec(line);
    if (extraKey) {
      errors.push(
        `unknown key "${extraKey[1] ?? ''}" — the only allowed key is \`paths\``,
      );
      continue;
    }

    const entryMatch = RULE_ENTRY_LINE.exec(line);
    if (!entryMatch) {
      errors.push(`unparseable paths entry "${line}"`);
      continue;
    }

    const raw = entryMatch[1] ?? '';
    const quoted = QUOTED_ENTRY.exec(raw);
    if (!quoted) {
      errors.push(
        `paths entry "${raw}" is not a single quoted glob — bare, unterminated, or followed by trailing content (e.g. a comment) all fail this check the same way`,
      );
      continue;
    }

    const glob = quoted[2] ?? '';
    if (glob.includes('[')) {
      errors.push(
        `paths entry "${raw}" contains "[" — Claude Code's glob matcher and path.matchesGlob disagree on bracket character classes, so none are used`,
      );
      continue;
    }
    if (glob.length === 0) {
      errors.push(`paths entry "${raw}" is empty`);
      continue;
    }

    globs.push(glob);
  }

  if (globs.length === 0 && errors.length === 0) {
    errors.push('paths has no entries');
  }

  return { globs, errors };
}

const FRONTMATTER_BODY = /^---\n[\s\S]*?\n---(?:\n|$)([\s\S]*)$/u;

export function validateRuleFile(
  file: string,
  fileText: string,
  trackedFiles: readonly string[],
  matchesGlob: (path: string, pattern: string) => boolean = nodeMatchesGlob,
): string[] {
  const frontmatter = extractFrontmatter(fileText);
  if (frontmatter === null) {
    return [`${file}: no leading --- frontmatter block`];
  }

  const { globs, errors } = parseRuleFrontmatter(frontmatter);

  const globErrors = globs.flatMap((glob) =>
    trackedFiles.some((path) => matchesGlob(path, glob))
      ? []
      : [`paths entry "${glob}" matches no git-tracked file`],
  );

  const body = FRONTMATTER_BODY.exec(fileText)?.[1] ?? '';
  const bodyErrors =
    body.trim() === '' ? ['rule file has no body after the frontmatter'] : [];

  return [...errors, ...globErrors, ...bodyErrors].map(
    (message) => `${file}: ${message}`,
  );
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

export function checkRulesDirectory(
  directory: string,
  trackedFiles: readonly string[],
  matchesGlob: (path: string, pattern: string) => boolean = nodeMatchesGlob,
): string[] {
  let entries: string[];
  try {
    entries = readdirSync(directory, { recursive: true, encoding: 'utf8' });
  } catch (error) {
    if (isEnoent(error)) return [`${directory}: directory not found`];
    throw error;
  }

  const files = entries
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => join(directory, entry));

  if (files.length === 0) return [`${directory}: no rule files found`];

  return files.flatMap((file) =>
    validateRuleFile(
      file,
      readFileSync(file, 'utf8'),
      trackedFiles,
      matchesGlob,
    ),
  );
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE_MD = join(REPO_ROOT, 'CLAUDE.md');
const AGENTS_MD = join(REPO_ROOT, 'AGENTS.md');
const RULES_DIR = join(REPO_ROOT, '.claude', 'rules');

function listTrackedFiles(cwd: string): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd,
    encoding: 'utf8',
  });
  return output.split('\0').filter((entry) => entry.length > 0);
}

// Runs only as a script, not when the test file imports it.
const entryPoint = process.argv[1];
if (entryPoint && fileURLToPath(import.meta.url) === realpathSync(entryPoint)) {
  const claudeErrors = checkClaudeStub(
    readFileSync(CLAUDE_MD, 'utf8'),
    existsSync(AGENTS_MD),
  ).map((error) => `CLAUDE.md: ${error}`);

  const trackedFiles = listTrackedFiles(REPO_ROOT);
  const ruleErrors = checkRulesDirectory(RULES_DIR, trackedFiles);

  const errors = [...claudeErrors, ...ruleErrors];
  for (const error of errors) console.error(`::error::${error}`);
  if (errors.length > 0) process.exit(1);
  console.log(
    'check-rulebook: CLAUDE.md is a valid stub and every .claude/rules/ file is well-formed.',
  );
}
