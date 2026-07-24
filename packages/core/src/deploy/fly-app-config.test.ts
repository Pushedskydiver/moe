import { describe, expect, it } from 'vitest';

import { personaIdSchema } from '../persona-roster.js';
import { buildFlyAppConfig } from './fly-app-config.js';

describe('buildFlyAppConfig', () => {
  it('derives the Fly app name from the persona id', () => {
    expect(buildFlyAppConfig('sarah').appName).toBe('moe-sarah');
  });

  it('names the config file so `fly deploy -c <file>` resolves it from the repo root', () => {
    expect(buildFlyAppConfig('sarah').fileName).toBe('fly.sarah.toml');
  });

  it('parameterizes the config by persona — app name and MOE_PERSONA_ID are the only per-persona values', () => {
    const { toml } = buildFlyAppConfig('maya');
    expect(toml).toContain('app = "moe-maya"');
    expect(toml).toContain('MOE_PERSONA_ID = "maya"');
  });

  it('gives every roster persona its own distinct Fly App and config file', () => {
    const configs = personaIdSchema.options.map((personaId) =>
      buildFlyAppConfig(personaId),
    );

    expect(configs).toHaveLength(8);
    expect(new Set(configs.map((config) => config.appName)).size).toBe(8);
    expect(new Set(configs.map((config) => config.fileName)).size).toBe(8);
  });

  it('health-checks each persona privately — no [http_service], so no public port is published', () => {
    const { toml } = buildFlyAppConfig('sarah');
    // Section headers only: a `#` comment naming [http_service] is fine, an actual section is not.
    const sections = toml
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('[') && line.endsWith(']'));

    expect(sections).not.toContain('[http_service]');
    expect(sections).toContain('[checks.health]');
    expect(toml).toContain('port = 8080');
    expect(toml).toContain('type = "http"');
    expect(toml).toContain('path = "/health"');
  });

  it("requests the health check with an uppercase GET, the only form Node's parser accepts", () => {
    expect(buildFlyAppConfig('sarah').toml).toContain('method = "GET"');
  });

  it('pins every persona to the London region, matching the production Neon project', () => {
    const missingRegion = personaIdSchema.options.filter(
      (personaId) =>
        !buildFlyAppConfig(personaId).toml.includes('primary_region = "lhr"'),
    );

    expect(missingRegion).toEqual([]);
  });

  it('warns in-file that the config is generated, and names the command that regenerates it', () => {
    const { toml } = buildFlyAppConfig('sarah');

    expect(toml.startsWith('# GENERATED FILE — do not hand-edit.')).toBe(true);
    expect(toml).toContain('pnpm --filter @moe/core generate:fly-configs');
  });

  it('documents the deploy command with --ha=false, which `fly deploy` does not default to', () => {
    expect(buildFlyAppConfig('theo').toml).toContain(
      'fly deploy -c fly.theo.toml --ha=false',
    );
  });
});
