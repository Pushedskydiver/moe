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

  it('flags a deploy with an app flag before the subcommand', () => {
    expect(classifyFly('fly -a moe-sarah deploy')).toBe('deploy');
  });

  it('flags a deploy after a global flag with no value', () => {
    expect(classifyFly('fly --debug deploy')).toBe('deploy');
  });

  it('flags fly deploy --build-only (a documented false positive)', () => {
    expect(classifyFly('fly deploy --build-only -c fly.sarah.toml')).toBe(
      'deploy',
    );
  });

  it.each([
    'cd x && fly deploy',
    'pnpm build; fly deploy',
    'echo hi | fly deploy',
    'echo $(fly deploy)',
    'sh -c "fly deploy"',
    'env FLY_API_TOKEN=x fly deploy',
  ])('flags a deploy inside a compound or wrapped command: %s', (command) => {
    expect(classifyFly(command)).toBe('deploy');
  });

  it.each([
    'superfly deploy',
    'moe-fly deploy',
    'moe.fly deploy',
    'butterfly deploy',
  ])('does not match a different binary that ends in fly: %s', (command) => {
    expect(classifyFly(command)).toBeNull();
  });

  it.each([
    'fly status -a moe-sarah',
    'fly logs -a moe-sarah',
    'fly checks list -a moe-sarah',
    'fly status -a deploy-app',
    'fly status && echo deploy',
    'fly logs -a moe-sarah | grep deploy',
    'git commit -m "fix deploy docs"',
  ])('does not flag a command that runs no fly deploy: %s', (command) => {
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
  ])(
    "does not flag a read-only secrets command or another binary's secrets command: %s",
    (command) => {
      expect(classifyFly(command)).toBeNull();
    },
  );

  it.each([
    'fly machine update 148e21 --image registry/x:tag -a moe-sarah',
    'fly machines update 148e21',
    'fly m update 148e21',
    'fly machine update 148e21 -a moe-sarah',
    'fly machine clone 148e21 -a moe-sarah',
    'fly machines clone 148e21',
    'fly m clone 148e21',
    'fly image update -a moe-sarah',
    'fly img update',
    'fly scale count 2 -a moe-sarah',
    'flyctl scale count 1',
    'cd x && fly scale count 2',
    'fly -a moe-sarah scale count 2',
  ])('flags a deploy-equivalent that changes live Machines: %s', (command) => {
    expect(classifyFly(command)).toBe('machines');
  });

  it.each([
    'fly machine list -a moe-sarah',
    'fly machine status 148e21',
    'fly m list',
    'fly image show',
    'fly scale show',
    'fly apps list',
    'fly app list',
    'fly scale vm shared-cpu-1x',
    'fly machine stop 148e21',
    'superfly scale count 2',
    'moe-fly machine update x',
  ])('does not flag a read-only or out-of-list command: %s', (command) => {
    expect(classifyFly(command)).toBeNull();
  });

  it.each([
    'fly apps destroy moe-sarah',
    'fly app destroy moe-sarah',
    'fly apps rm moe-sarah',
    'fly apps delete moe-sarah',
    'fly apps remove moe-sarah',
    'fly destroy moe-sarah',
    'flyctl destroy moe-sarah',
    'fly machine destroy 148e21',
    'fly volumes destroy vol_123',
    'cd x && fly apps destroy moe-sarah',
  ])('flags a command that destroys live Fly resources: %s', (command) => {
    expect(classifyFly(command)).toBe('destroy');
  });

  it('does not flag another binary that ends in fly destroying an app', () => {
    expect(classifyFly('moe-fly apps destroy x')).toBeNull();
  });
});

describe('evaluateCommand', () => {
  it('asks with the image reason for a deploy', () => {
    const result = evaluateCommand('fly deploy -c fly.sarah.toml --ha=false');
    expect(result.ask).toBe(true);
    expect(result.ask && result.reason).toContain('ship a new image');
  });

  it('asks with the secrets reason for a mutating secrets command', () => {
    const result = evaluateCommand('fly secrets set -a moe-sarah FOO=bar');
    expect(result.ask).toBe(true);
    expect(result.ask && result.reason).toContain('truncated or empty secret');
  });

  it('asks with the Machines reason for a deploy-equivalent', () => {
    const result = evaluateCommand('fly scale count 2 -a moe-sarah');
    expect(result.ask).toBe(true);
    expect(result.ask && result.reason).toContain(
      "changes a live persona App's Machines",
    );
  });

  it('asks with the destroy reason for fly apps destroy', () => {
    const result = evaluateCommand('fly apps destroy moe-sarah');
    expect(result.ask).toBe(true);
    expect(result.ask && result.reason).toContain(
      'removes a whole persona App',
    );
  });

  it('asks with the secrets reason for fly secrets deploy, not the image one', () => {
    const result = evaluateCommand('fly secrets deploy -a moe-sarah');
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
      'ship a new image',
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
