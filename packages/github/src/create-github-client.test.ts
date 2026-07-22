import { describe, expect, it, vi } from 'vitest';

import { createGithubClient } from './create-github-client.js';

const mocks = vi.hoisted(() => ({
  Octokit: vi.fn(),
  createAppAuth: vi.fn(),
  createGithubSdkLoggerAdapter: vi.fn(),
}));

vi.mock('octokit', () => ({ Octokit: mocks.Octokit }));
vi.mock('@octokit/auth-app', () => ({ createAppAuth: mocks.createAppAuth }));
vi.mock('./create-github-sdk-logger-adapter.js', () => ({
  createGithubSdkLoggerAdapter: mocks.createGithubSdkLoggerAdapter,
}));

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createGithubClient', () => {
  it('builds an authenticated Octokit client wired with a redacting logger at both the request and auth-strategy layers', () => {
    const logger = makeLogger();
    const fakeAdapter = { info: vi.fn() };
    mocks.createGithubSdkLoggerAdapter.mockReturnValue(fakeAdapter);

    createGithubClient(
      {
        appId: '123456',
        privateKey: 'fake-key',
        installationId: 789,
        repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
      },
      logger,
    );

    expect(mocks.createGithubSdkLoggerAdapter).toHaveBeenCalledWith(logger, [
      'fake-key',
    ]);
    expect(mocks.Octokit).toHaveBeenCalledWith({
      authStrategy: mocks.createAppAuth,
      auth: {
        appId: '123456',
        privateKey: 'fake-key',
        installationId: 789,
        log: fakeAdapter,
      },
      log: fakeAdapter,
    });
  });
});
