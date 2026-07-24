import type { ManifestClient } from './provision-persona-slack-app.js';

import { describe, expect, it, vi } from 'vitest';

import { provisionPersonaSlackApp } from './provision-persona-slack-app.js';

function makeClient(overrides: {
  readonly validate?: ManifestClient['apps']['manifest']['validate'];
  readonly create?: ManifestClient['apps']['manifest']['create'];
}): ManifestClient {
  return {
    apps: {
      manifest: {
        validate: overrides.validate ?? (() => Promise.resolve({ ok: true })),
        create:
          overrides.create ??
          (() =>
            Promise.resolve({
              ok: true,
              app_id: 'A012ABCD0A0',
              credentials: {
                client_id: 'fake-client-id',
                signing_secret: 'fake-signing-secret',
              },
              oauth_authorize_url: 'https://slack.com/oauth/authorize?fake',
            })),
      },
    },
  };
}

describe('provisionPersonaSlackApp', () => {
  it('returns the captured app_id/client_id/signing_secret/oauth_authorize_url on success', async () => {
    const client = makeClient({});

    const result = await provisionPersonaSlackApp(client, 'maya');

    expect(result).toEqual({
      ok: true,
      app: {
        personaId: 'maya',
        appId: 'A012ABCD0A0',
        clientId: 'fake-client-id',
        signingSecret: 'fake-signing-secret',
        oauthAuthorizeUrl: 'https://slack.com/oauth/authorize?fake',
      },
    });
  });

  it('calls validate before create, with the same manifest JSON', async () => {
    const validate = vi.fn((_args: { readonly manifest: string }) =>
      Promise.resolve({ ok: true }),
    );
    const create = vi.fn((_args: { readonly manifest: string }) =>
      Promise.resolve({
        ok: true,
        app_id: 'A1',
        credentials: { client_id: 'c', signing_secret: 's' },
        oauth_authorize_url: 'https://slack.com/oauth/authorize?fake',
      }),
    );
    const client = makeClient({ validate, create });

    await provisionPersonaSlackApp(client, 'sarah');

    expect(validate).toHaveBeenCalledWith({ manifest: expect.any(String) });
    expect(create).toHaveBeenCalledWith({ manifest: expect.any(String) });
    const validateArg = validate.mock.calls[0]?.[0]?.manifest;
    const createArg = create.mock.calls[0]?.[0]?.manifest;
    expect(validateArg).toBe(createArg);
    expect(JSON.parse(validateArg ?? '')).toMatchObject({
      display_information: { name: 'Sarah' },
    });
  });

  it('returns validation-failed and never calls create when validate resolves ok:false', async () => {
    const create = vi.fn();
    const client = makeClient({
      validate: () => Promise.resolve({ ok: false, error: 'invalid_manifest' }),
      create,
    });

    const result = await provisionPersonaSlackApp(client, 'dom');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation-failed', message: 'invalid_manifest' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns validation-failed (not creation-failed) when validate itself throws, and never calls create', async () => {
    const create = vi.fn();
    const client = makeClient({
      validate: () =>
        Promise.reject(new Error('An API error occurred: invalid_auth')),
      create,
    });

    const result = await provisionPersonaSlackApp(client, 'nia');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        message: 'An API error occurred: invalid_auth',
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns creation-failed when create resolves ok:false', async () => {
    const client = makeClient({
      create: () => Promise.resolve({ ok: false, error: 'app_limit_reached' }),
    });

    const result = await provisionPersonaSlackApp(client, 'theo');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'creation-failed', message: 'app_limit_reached' },
    });
  });

  it('returns incomplete-response when the credentials object is missing a required field', async () => {
    const client = makeClient({
      create: () =>
        Promise.resolve({
          ok: true,
          app_id: 'A1',
          credentials: { client_id: 'c' },
          oauth_authorize_url: 'https://slack.com/oauth/authorize?fake',
        }),
    });

    const result = await provisionPersonaSlackApp(client, 'priya');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'incomplete-response',
        message: 'apps.manifest.create response was missing a required field',
      },
    });
  });

  it('returns creation-failed when the client throws (the real WebClient throws on a Slack-reported error)', async () => {
    const client = makeClient({
      create: () =>
        Promise.reject(new Error('An API error occurred: ratelimited')),
    });

    const result = await provisionPersonaSlackApp(client, 'nia');

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'creation-failed',
        message: 'An API error occurred: ratelimited',
      },
    });
  });
});
