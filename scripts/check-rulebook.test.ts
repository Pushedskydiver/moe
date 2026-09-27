import { describe, expect, it } from 'vitest';

import {
  checkClaudeStub,
  checkRulesDirectory,
  parseRuleFrontmatter,
  validateRuleFile,
} from './check-rulebook.ts';

describe('checkClaudeStub', () => {
  const stub = '# Moe Monorepo\n\nOne sentence.\n\n@AGENTS.md\n';

  it('accepts a valid stub with AGENTS.md present', () => {
    expect(checkClaudeStub(stub, true)).toEqual([]);
  });

  it('reports AGENTS.md missing', () => {
    expect(checkClaudeStub(stub, false)).toEqual(['AGENTS.md does not exist']);
  });

  it('reports a missing @AGENTS.md import line', () => {
    const errors = checkClaudeStub('# Moe Monorepo\n\nNo import here.\n', true);
    expect(errors).toEqual([
      'no `@AGENTS.md` import line found (outside any fenced code block, unindented)',
    ]);
  });

  it('reports an import line that appears more than once', () => {
    const errors = checkClaudeStub('@AGENTS.md\n\n@AGENTS.md\n', true);
    expect(errors).toEqual([
      '`@AGENTS.md` import line appears 2 times, expected exactly once',
    ]);
  });

  it('rejects an @AGENTS.md line only inside a fenced code block', () => {
    const text = '# Moe Monorepo\n\n```\n@AGENTS.md\n```\n';
    expect(checkClaudeStub(text, true)).toEqual([
      'no `@AGENTS.md` import line found (outside any fenced code block, unindented)',
    ]);
  });

  it('rejects an indented @AGENTS.md line', () => {
    const text = '# Moe Monorepo\n\n  @AGENTS.md\n';
    expect(checkClaudeStub(text, true)).toEqual([
      'no `@AGENTS.md` import line found (outside any fenced code block, unindented)',
    ]);
  });

  it('caps the stub at 10 non-empty lines', () => {
    const lines = Array.from({ length: 11 }, (_, i) => `line ${i}`).join('\n');
    const errors = checkClaudeStub(`${lines}\n@AGENTS.md\n`, true);
    expect(errors).toEqual(['has 12 non-empty lines, expected at most 10']);
  });
});

describe('parseRuleFrontmatter', () => {
  it('parses a valid quoted block list', () => {
    const { globs, errors } = parseRuleFrontmatter(
      "paths:\n  - 'packages/slack/src/**'\n  - 'packages/github/src/**'",
    );
    expect(globs).toEqual(['packages/slack/src/**', 'packages/github/src/**']);
    expect(errors).toEqual([]);
  });

  it('accepts double-quoted entries too', () => {
    const { globs, errors } = parseRuleFrontmatter(
      'paths:\n  - "packages/slack/src/**"',
    );
    expect(globs).toEqual(['packages/slack/src/**']);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown top-level key', () => {
    const { errors } = parseRuleFrontmatter("scope:\n  - 'x'");
    expect(errors).toEqual([
      'unknown key "scope" — the only allowed key is `paths`',
    ]);
  });

  it('rejects an inline flow-list value', () => {
    const { errors } = parseRuleFrontmatter("paths: ['a', 'b']");
    expect(errors).toEqual([
      "paths must be a YAML block list (one glob per `  - '...'` line), not an inline or scalar value",
    ]);
  });

  it('rejects a bare scalar value', () => {
    const { errors } = parseRuleFrontmatter('paths: foo');
    expect(errors).toEqual([
      "paths must be a YAML block list (one glob per `  - '...'` line), not an inline or scalar value",
    ]);
  });

  it('rejects a bare, unquoted entry (YAML alias token)', () => {
    const { errors } = parseRuleFrontmatter('paths:\n  - *.ts');
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/must be quoted|not a single quoted glob/u);
  });

  it('rejects a bracketed-flow-list entry', () => {
    const { errors } = parseRuleFrontmatter('paths:\n  - {a,b}/x.ts');
    expect(errors.length).toBe(1);
  });

  it('rejects an entry containing a bracket class', () => {
    const { errors } = parseRuleFrontmatter("paths:\n  - '[x]/y.ts'");
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('[');
  });

  it('rejects a quoted entry followed by a trailing comment', () => {
    const { errors } = parseRuleFrontmatter(
      "paths:\n  - 'packages/slack/src/**' # comment",
    );
    expect(errors.length).toBe(1);
  });

  it('skips blank lines and column-0 # comments', () => {
    const { globs, errors } = parseRuleFrontmatter(
      "# a comment\npaths:\n\n  - 'packages/slack/src/**'\n",
    );
    expect(globs).toEqual(['packages/slack/src/**']);
    expect(errors).toEqual([]);
  });

  it('reports no paths key found when the block is empty', () => {
    const { errors } = parseRuleFrontmatter('');
    expect(errors).toEqual(['no `paths` key found']);
  });
});

describe('validateRuleFile', () => {
  const alwaysMatch = () => true;
  const neverMatch = () => false;

  const dummyTracked = ['packages/slack/src/index.ts'];

  it('accepts a well-formed rule file', () => {
    const text =
      "---\npaths:\n  - 'packages/slack/src/**'\n---\n\n# Slack\n\nBody text.\n";
    expect(validateRuleFile('r.md', text, dummyTracked, alwaysMatch)).toEqual(
      [],
    );
  });

  it('reports a missing frontmatter block', () => {
    expect(
      validateRuleFile('r.md', '# No frontmatter\n', dummyTracked, alwaysMatch),
    ).toEqual(['r.md: no leading --- frontmatter block']);
  });

  it('fails a CRLF file as missing frontmatter', () => {
    const text = "---\r\npaths:\r\n  - 'x'\r\n---\r\n\r\nBody.\r\n";
    expect(validateRuleFile('r.md', text, dummyTracked, alwaysMatch)).toEqual([
      'r.md: no leading --- frontmatter block',
    ]);
  });

  it('fails a BOM-prefixed file as missing frontmatter', () => {
    const text = "﻿---\npaths:\n  - 'x'\n---\n\nBody.\n";
    expect(validateRuleFile('r.md', text, dummyTracked, alwaysMatch)).toEqual([
      'r.md: no leading --- frontmatter block',
    ]);
  });

  it('reports a glob matching no tracked file', () => {
    const text = "---\npaths:\n  - 'packages/slack/src/**'\n---\n\nBody.\n";
    expect(validateRuleFile('r.md', text, dummyTracked, neverMatch)).toEqual([
      'r.md: paths entry "packages/slack/src/**" matches no git-tracked file',
    ]);
  });

  it('reports an empty body after the frontmatter', () => {
    const text = "---\npaths:\n  - 'packages/slack/src/**'\n---\n";
    expect(validateRuleFile('r.md', text, dummyTracked, alwaysMatch)).toEqual([
      'r.md: rule file has no body after the frontmatter',
    ]);
  });
});

describe('checkRulesDirectory', () => {
  it('reports a missing directory as a normal error, not an uncaught exception', () => {
    expect(() =>
      checkRulesDirectory(
        '/nonexistent/path/for/check-rulebook-test',
        [],
        () => true,
      ),
    ).not.toThrow();
    expect(
      checkRulesDirectory(
        '/nonexistent/path/for/check-rulebook-test',
        [],
        () => true,
      ),
    ).toEqual([
      '/nonexistent/path/for/check-rulebook-test: directory not found',
    ]);
  });
});
