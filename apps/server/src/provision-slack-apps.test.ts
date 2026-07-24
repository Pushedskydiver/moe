import type { ProvisionSlackAppsDeps } from './provision-slack-apps.js';
import type { ManifestClient } from '@moe/slack';

import { describe, expect, it, vi } from 'vitest';

import { provisionSlackApps } from './provision-slack-apps.js';

function makeManifestClient(
  createImpl?: ManifestClient['apps']['manifest']['create'],
  validateImpl?: ManifestClient['apps']['manifest']['validate'],
): ManifestClient {
  return {
    apps: {
      manifest: {
        validate: validateImpl ?? vi.fn().mockResolvedValue({ ok: true }),
        create:
          createImpl ??
          vi.fn().mockResolvedValue({
            ok: true,
            app_id: 'A1',
            credentials: { client_id: 'c', signing_secret: 's' },
            oauth_authorize_url: 'https://slack.com/oauth/authorize?fake',
          }),
      },
    },
  };
}

function makeDeps(
  overrides: Partial<ProvisionSlackAppsDeps> = {},
): ProvisionSlackAppsDeps {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    manifestClient: makeManifestClient(),
    personaIds: ['marcus'],
    waitMs: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('provisionSlackApps', () => {
  it('provisions every given persona and logs a completion summary', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const deps = makeDeps({ logger, personaIds: ['marcus', 'riley'] });

    await provisionSlackApps(deps);

    expect(logger.info).toHaveBeenCalledWith(
      'slack app provisioning run complete',
      { personaCount: 2 },
    );
  });

  it('waits the rate-limit interval between create calls, but not before the first', async () => {
    const waitMs = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ personaIds: ['marcus', 'riley', 'priya'], waitMs });

    await provisionSlackApps(deps);

    expect(waitMs).toHaveBeenCalledTimes(2);
    expect(waitMs).toHaveBeenCalledWith(60_000);
  });

  it("doesn't wait at all for a single-persona run", async () => {
    const waitMs = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ personaIds: ['maya'], waitMs });

    await provisionSlackApps(deps);

    expect(waitMs).not.toHaveBeenCalled();
  });

  it("doesn't wait before the next persona when the previous one failed at validate — no create call, so no budget was spent", async () => {
    const waitMs = vi.fn().mockResolvedValue(undefined);
    const validate = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'invalid_manifest' })
      .mockResolvedValue({ ok: true });
    const manifestClient = makeManifestClient(undefined, validate);
    const deps = makeDeps({
      manifestClient,
      personaIds: ['dom', 'theo'],
      waitMs,
    });

    await provisionSlackApps(deps);

    expect(waitMs).not.toHaveBeenCalled();
  });

  it('logs an error and continues to the next persona when one fails', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    let callCount = 0;
    const manifestClient = makeManifestClient(() => {
      callCount += 1;
      return callCount === 1
        ? Promise.resolve({ ok: false, error: 'app_limit_reached' })
        : Promise.resolve({
            ok: true,
            app_id: 'A2',
            credentials: { client_id: 'c2', signing_secret: 's2' },
            oauth_authorize_url: 'https://slack.com/oauth/authorize?fake2',
          });
    });
    const deps = makeDeps({
      logger,
      manifestClient,
      personaIds: ['dom', 'theo'],
    });

    await provisionSlackApps(deps);

    expect(logger.error).toHaveBeenCalledWith(
      'failed to provision persona Slack app',
      {
        personaId: 'dom',
        errorKind: 'creation-failed',
        errorMessage: 'app_limit_reached',
      },
    );
    expect(logger.info).toHaveBeenCalledWith(
      'slack app provisioning run complete',
      { personaCount: 2 },
    );
  });

  it('produces no output at all for an empty persona-id list', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const deps = makeDeps({ logger, personaIds: [] });

    await provisionSlackApps(deps);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'slack app provisioning run complete',
      { personaCount: 0 },
    );
  });
});
