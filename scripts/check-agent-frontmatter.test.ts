import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  checkAgentDirectory,
  extractFrontmatter,
  parseFrontmatter,
  validateAgentFile,
} from './check-agent-frontmatter.ts';

describe('extractFrontmatter', () => {
  it('returns the text between the leading --- fences', () => {
    const text = '---\nname: da-review\nmodel: opus\n---\n\nBody text.\n';

    expect(extractFrontmatter(text)).toBe('name: da-review\nmodel: opus');
  });

  it('returns null when the file has no leading frontmatter block', () => {
    expect(extractFrontmatter('# Heading\n\n---\nname: x\n---\n')).toBeNull();
  });
});

describe('parseFrontmatter', () => {
  it('reads flat key: value lines, trimming and unquoting values', () => {
    const { fields } = parseFrontmatter(
      'name: da-review\ndescription: "Reviews PRs."\nmodel:   opus  ',
    );

    expect(fields).toEqual({
      name: 'da-review',
      description: 'Reviews PRs.',
      model: 'opus',
    });
  });

  it('reports a repeated key, so a later value cannot mask an earlier one', () => {
    const { fields, duplicateKeys } = parseFrontmatter(
      'model: inherit\nmodel: opus',
    );

    expect(duplicateKeys).toEqual(['model']);
    expect(fields['model']).toBe('opus');
  });

  it('reads a bare block-scalar marker as empty, not as the value', () => {
    const { fields } = parseFrontmatter('description: >-\n  Folded text.');

    expect(fields['description']).toBe('');
  });
});

const agentFile = (frontmatter: string): string =>
  `---\n${frontmatter}\n---\n\nYou are the reviewer.\n`;

const VALID_FRONTMATTER = [
  'name: da-review',
  "description: Devil's-advocate review.",
  'tools: Read, Grep, Glob, Bash',
  'model: opus',
  'effort: high',
].join('\n');

describe('validateAgentFile', () => {
  const path = '.claude/agents/da-review.md';

  it('accepts a pinned model and effort', () => {
    expect(validateAgentFile(path, agentFile(VALID_FRONTMATTER))).toEqual([]);
  });

  it('rejects model: inherit, which follows the dispatching session', () => {
    const text = agentFile(
      VALID_FRONTMATTER.replace('model: opus', 'model: inherit'),
    );

    expect(validateAgentFile(path, text)).toEqual([
      expect.stringContaining('model'),
    ]);
  });
  it('rejects a missing model', () => {
    const text = agentFile(VALID_FRONTMATTER.replace('model: opus\n', ''));

    expect(validateAgentFile(path, text)).toEqual([
      expect.stringContaining('model'),
    ]);
  });

  it('accepts a file with no effort key', () => {
    const text = agentFile(VALID_FRONTMATTER.replace('\neffort: high', ''));

    expect(validateAgentFile(path, text)).toEqual([]);
  });

  it('rejects an effort outside the allowed levels', () => {
    const text = agentFile(
      VALID_FRONTMATTER.replace('effort: high', 'effort: extreme'),
    );

    expect(validateAgentFile(path, text)).toEqual([
      expect.stringContaining('effort'),
    ]);
  });

  it('rejects an empty description', () => {
    const text = agentFile(
      VALID_FRONTMATTER.replace(
        "description: Devil's-advocate review.",
        'description:',
      ),
    );

    expect(validateAgentFile(path, text)).toEqual([
      expect.stringContaining('description'),
    ]);
  });

  it('rejects a name that differs from the filename', () => {
    const text = agentFile(
      VALID_FRONTMATTER.replace('name: da-review', 'name: da-reviewer'),
    );

    expect(validateAgentFile(path, text)).toEqual([
      expect.stringContaining('"da-reviewer" does not match the filename'),
    ]);
  });

  it('rejects an unknown key and says how to allow a real one', () => {
    const text = agentFile(`${VALID_FRONTMATTER}\ntolls: Read`);

    expect(validateAgentFile(path, text)).toEqual([
      expect.stringContaining('add it to the schema'),
    ]);
  });

  it('rejects a repeated key', () => {
    const text = agentFile(
      VALID_FRONTMATTER.replace('model: opus', 'model: inherit\nmodel: opus'),
    );

    expect(validateAgentFile(path, text)).toEqual([
      expect.stringContaining('"model" appears more than once'),
    ]);
  });

  it('rejects a file with no frontmatter block', () => {
    expect(validateAgentFile(path, 'You are the reviewer.\n')).toEqual([
      expect.stringContaining('no leading --- frontmatter block'),
    ]);
  });
});

describe('checkAgentDirectory', () => {
  it('checks .md files in nested folders too', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agents-'));
    mkdirSync(join(directory, 'review'));
    writeFileSync(
      join(directory, 'review', 'da-review.md'),
      agentFile(VALID_FRONTMATTER.replace('model: opus', 'model: inherit')),
    );

    expect(checkAgentDirectory(directory)).toEqual([
      expect.stringContaining('da-review.md: model'),
    ]);
  });

  it('fails when the directory holds no agent files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agents-'));

    expect(checkAgentDirectory(directory)).toEqual([
      expect.stringContaining('no agent files found'),
    ]);
  });
});
