import { describe, expect, it, vi } from 'vitest';

import { createManifestClient } from './create-manifest-client.js';

const mocks = vi.hoisted(() => ({
  WebClient: vi.fn(),
  createSdkLoggerAdapter: vi.fn(),
}));

vi.mock('@slack/web-api', () => ({ WebClient: mocks.WebClient }));
vi.mock('./create-sdk-logger-adapter.js', () => ({
  createSdkLoggerAdapter: mocks.createSdkLoggerAdapter,
}));

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createManifestClient', () => {
  it('passes an adapter built from the given logger and config token to the WebClient constructor', () => {
    const logger = makeLogger();
    const fakeAdapter = { info: vi.fn() };
    mocks.createSdkLoggerAdapter.mockReturnValue(fakeAdapter);

    createManifestClient('fake-config-token', logger);

    expect(mocks.createSdkLoggerAdapter).toHaveBeenCalledWith(logger, [
      'fake-config-token',
    ]);
    expect(mocks.WebClient).toHaveBeenCalledWith('fake-config-token', {
      logger: fakeAdapter,
    });
  });
});
