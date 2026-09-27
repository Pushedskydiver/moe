// Validates the frontmatter of every `.claude/agents/**/*.md` file. Run by CI's "Agent
// frontmatter" job (`pnpm check:agents`); see docs/DEVELOPMENT.md §Quality Gates.

import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

// `inherit` is deliberately absent: `inherit` takes the main conversation's model, and an omitted
// `model` falls back to `CLAUDE_CODE_SUBAGENT_MODEL` if set, else the main conversation's model —
// either way a session on a smaller model silently weakens every review it dispatches.
const MODELS = ['opus', 'sonnet', 'haiku'] as const;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

const nonEmpty = z.string().trim().min(1, 'must not be empty');

const agentFrontmatterSchema = z.strictObject({
  name: nonEmpty,
  description: nonEmpty,
  tools: nonEmpty,
  model: z.enum(MODELS),
  effort: z.enum(EFFORTS).optional(),
});

export function extractFrontmatter(fileText: string): string | null {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(fileText);
  return match?.[1] ?? null;
}

type ParsedFrontmatter = {
  readonly fields: Readonly<Record<string, string>>;
  readonly duplicateKeys: readonly string[];
  readonly unparseableLines: readonly string[];
};

const KEY_VALUE_LINE = /^([\w-]+):(?:\s+(.*))?$/u;

// Deliberately not a YAML parser: every agent file uses flat `key: value` lines, and that is the
// only shape this reads. A block scalar (`description: >-` plus indented lines) can't be followed
// onto its continuation lines, so its bare marker reads as an empty value and fails validation
// rather than passing as content. Any other non-blank line at column 0 (e.g. `effort:high`, which
// YAML rejects) is returned as unparseable, never silently skipped.
export function parseFrontmatter(frontmatterText: string): ParsedFrontmatter {
  const lines = frontmatterText.split('\n');
  const entries = lines
    .map((line) => KEY_VALUE_LINE.exec(line))
    .filter((match) => match !== null)
    .map(([, key = '', rawValue = '']) => [key, toValue(rawValue)] as const);

  const keys = entries.map(([key]) => key);
  const duplicateKeys = [
    ...new Set(keys.filter((key, index) => keys.indexOf(key) !== index)),
  ];

  const unparseableLines = lines.filter(
    (line) => /^[^\s#]/u.test(line) && !KEY_VALUE_LINE.test(line),
  );

  return {
    fields: Object.fromEntries(entries),
    duplicateKeys,
    unparseableLines,
  };
}

function toValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (/^[|>][+-]?$/u.test(trimmed)) return '';
  return trimmed.replace(/^(["'])(.*)\1$/u, '$2');
}

export function validateAgentFile(file: string, fileText: string): string[] {
  const frontmatter = extractFrontmatter(fileText);
  if (frontmatter === null)
    return [`${file}: no leading --- frontmatter block`];

  const { fields, duplicateKeys, unparseableLines } =
    parseFrontmatter(frontmatter);
  const result = agentFrontmatterSchema.safeParse(fields);
  const name = fields['name'];
  const expectedName = basename(file, '.md');

  return [
    ...unparseableLines.map(
      (line) => `unparseable line "${line}" — expected \`key: value\``,
    ),
    ...duplicateKeys.map((key) => `"${key}" appears more than once`),
    ...(result.success
      ? []
      : result.error.issues.map((issue) => describeIssue(issue))),
    ...(name && name !== expectedName
      ? [`name "${name}" does not match the filename "${expectedName}"`]
      : []),
  ].map((message) => `${file}: ${message}`);
}

function describeIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === 'unrecognized_keys') {
    return `unknown key(s) ${issue.keys.join(', ')} — a typo, or a real Claude Code agent key (e.g. isolation, color): add it to the schema in scripts/check-agent-frontmatter.ts`;
  }
  return `${issue.path.join('.')}: ${issue.message}`;
}

export function checkAgentDirectory(directory: string): string[] {
  const files = readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => join(directory, entry));

  if (files.length === 0) return [`${directory}: no agent files found`];

  return files.flatMap((file) =>
    validateAgentFile(file, readFileSync(file, 'utf8')),
  );
}

const AGENTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.claude',
  'agents',
);

// Runs only as a script, not when the test file imports it.
const entryPoint = process.argv[1];
if (entryPoint && fileURLToPath(import.meta.url) === realpathSync(entryPoint)) {
  const errors = checkAgentDirectory(AGENTS_DIR);
  for (const error of errors) console.error(`::error::${error}`);
  if (errors.length > 0) process.exit(1);
  console.log('check-agent-frontmatter: every agent pins a valid model.');
}
