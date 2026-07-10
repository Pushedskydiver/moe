// Generates AGENTS.md from CLAUDE.md. Marker conventions: docs/DEVELOPMENT.md
// §AGENTS.md generation. Run `pnpm generate:agents-md`, then `pnpm format`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO_ROOT, 'CLAUDE.md');
const DST = join(REPO_ROOT, 'AGENTS.md');

const SYNC_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['.claude/agents/*.md', '.codex/agents/*.toml'],
  ['Claude Code', 'Codex'],
  ['CLAUDE.md', 'AGENTS.md'],
  ['.claude/', '.codex/'],
  ['Claude', 'Codex'],
];

const HEADER =
  '<!-- GENERATED FILE — do not hand-edit. Run `pnpm generate:agents-md` after editing CLAUDE.md. -->\n' +
  '<!-- Sync table: "Claude Code"->"Codex", "CLAUDE.md"->"AGENTS.md", ".claude/"->".codex/", bare "Claude"->"Codex". ' +
  'Text wrapped in <!-- literal:start/end --> in the source is copied verbatim, exempt from the swap — ' +
  "it describes a fact about personas' target-repo convention, not about which agent reads this file. -->\n\n";

function stripSourceOnly(text: string): string {
  return text.replace(
    /<!-- source-only:start -->.*?<!-- source-only:end -->\n?/gs,
    '',
  );
}

function stashLiterals(text: string): { text: string; spans: string[] } {
  const spans: string[] = [];
  const stashed = text.replace(
    /<!-- literal:start -->(.*?)<!-- literal:end -->/gs,
    (_match, span: string) => {
      spans.push(span);
      return `__LITERAL_${spans.length - 1}__`;
    },
  );
  return { text: stashed, spans };
}

function applySyncTable(text: string): string {
  let result = text;
  for (const [from, to] of SYNC_TABLE) {
    result = result.replaceAll(from, to);
  }
  return result;
}

function restoreLiterals(text: string, spans: readonly string[]): string {
  let result = text;
  spans.forEach((span, i) => {
    result = result.replaceAll(`__LITERAL_${i}__`, span);
  });
  return result;
}

const source = readFileSync(SRC, 'utf8');
const withoutSourceOnly = stripSourceOnly(source);
const { text: stashed, spans } = stashLiterals(withoutSourceOnly);
const synced = applySyncTable(stashed);
const restored = restoreLiterals(synced, spans);

writeFileSync(DST, HEADER + restored);
console.log(`wrote ${DST}`);
