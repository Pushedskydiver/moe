import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { classifyFly, evaluateCommand } from './guard-fly.ts';

describe('classifyFly', () => {
  it('flags fly deploy with flags', () => {
    expect(classifyFly('fly deploy -c fly.sarah.toml --ha=false')).toBe(
      'deploy',
    );
  });

  it('flags flyctl deploy', () => {
    expect(classifyFly('flyctl deploy')).toBe('deploy');
  });

  it('flags a deploy with global flags before the subcommand', () => {
    expect(classifyFly('fly -a moe-sarah deploy')).toBe('deploy');
  });

  it.each([
    'cd x && fly deploy',
    'pnpm build; fly deploy',
    'echo hi | fly deploy',
    'echo $(fly deploy)',
    'sh -c "fly deploy"',
    'env FLY_API_TOKEN=x fly deploy',
  ])('flags a deploy inside a compound command: %s', (command) => {
    expect(classifyFly(command)).toBe('deploy');
  });

  it.each(['superfly deploy', 'moe-fly deploy', 'butterfly deploy'])(
    'does not match a different binary that ends in fly: %s',
    (command) => {
      expect(classifyFly(command)).toBeNull();
    },
  );

  it.each([
    'fly status -a moe-sarah',
    'fly logs -a moe-sarah',
    'fly checks list -a moe-sarah',
    'fly status -a deploy-app',
    'fly status && echo deploy',
    'fly logs -a moe-sarah | grep deploy',
    'git commit -m "fix deploy docs"',
  ])('does not flag a non-deploy fly command: %s', (command) => {
    expect(classifyFly(command)).toBeNull();
  });

  it.each(['set', 'unset', 'import', 'deploy', 'sync'])(
    'flags fly secrets %s',
    (subcommand) => {
      expect(classifyFly(`fly secrets ${subcommand} -a moe-sarah`)).toBe(
        'secrets',
      );
    },
  );

  it.each([
    'fly secrets set -a moe-sarah --stage FOO=bar',
    'flyctl secrets unset FOO -a moe-sarah',
    'fly secrets -a moe-sarah set FOO=bar',
    'cd x && fly secrets import < .env',
    'echo $(fly secrets sync)',
  ])('flags a mutating secrets command: %s', (command) => {
    expect(classifyFly(command)).toBe('secrets');
  });

  it.each([
    'fly secrets',
    'fly secrets list -a moe-sarah',
    'fly secrets list -a set-app',
    'superfly secrets set FOO=bar',
    'moe-fly secrets set FOO=bar',
  ])('does not flag a non-mutating secrets command: %s', (command) => {
    expect(classifyFly(command)).toBeNull();
  });
});

describe('evaluateCommand', () => {
  it('asks with the image reason for a deploy', () => {
    const result = evaluateCommand('fly deploy -c fly.sarah.toml --ha=false');
    expect(result.ask).toBe(true);
    expect(result.ask && result.reason).toContain('ships a new image');
  });

  it('asks with the secrets reason for a mutating secrets command', () => {
    const result = evaluateCommand('fly secrets set -a moe-sarah FOO=bar');
    expect(result.ask).toBe(true);
    expect(result.ask && result.reason).toContain('truncated or empty secret');
  });

  it('does not ask for a read-only fly command', () => {
    expect(evaluateCommand('fly status -a moe-sarah')).toEqual({ ask: false });
  });

  it('does not ask for a command with no fly in it', () => {
    expect(evaluateCommand('pnpm build')).toEqual({ ask: false });
  });
});

describe('hook entry point', () => {
  const script = fileURLToPath(new URL('./guard-fly.ts', import.meta.url));
  const run = (stdin: string) =>
    spawnSync(process.execPath, [script], { input: stdin, encoding: 'utf8' });
  const bashInput = (command: string) =>
    JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

  it('emits the PreToolUse ask JSON for a fly deploy on stdin', () => {
    const result = run(bashInput('cd x && fly deploy -c fly.sarah.toml'));
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: Record<string, string>;
    };
    expect(output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
    });
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain(
      'ships a new image',
    );
  });

  it('emits nothing for a non-matching command', () => {
    const result = run(bashInput('fly status -a moe-sarah'));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it.each([
    ['empty stdin', ''],
    ['unparseable JSON', 'not json'],
    [
      'non-Bash input',
      JSON.stringify({
        tool_name: 'Read',
        tool_input: { command: 'fly deploy' },
      }),
    ],
  ])('fails open with no output for %s', (_label, stdin) => {
    const result = run(stdin);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
