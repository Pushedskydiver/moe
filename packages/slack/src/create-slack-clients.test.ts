import { describe, expect, it, vi } from 'vitest';

import {
  createSocketModeClient,
  createWebClient,
} from './create-slack-clients.js';

const mocks = vi.hoisted(() => ({
  WebClient: vi.fn(),
  SocketModeClient: vi.fn(),
  createSdkLoggerAdapter: vi.fn(),
}));

vi.mock('@slack/web-api', () => ({ WebClient: mocks.WebClient }));
vi.mock('@slack/socket-mode', () => ({
  SocketModeClient: mocks.SocketModeClient,
}));
vi.mock('./create-sdk-logger-adapter.js', () => ({
  createSdkLoggerAdapter: mocks.createSdkLoggerAdapter,
}));

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createWebClient', () => {
  it('passes an adapter built from the given logger and token to the WebClient constructor', () => {
    const logger = makeLogger();
    const fakeAdapter = { info: vi.fn() };
    mocks.createSdkLoggerAdapter.mockReturnValue(fakeAdapter);

    createWebClient('fake-bot-token', logger);

    expect(mocks.createSdkLoggerAdapter).toHaveBeenCalledWith(logger, [
      'fake-bot-token',
    ]);
    expect(mocks.WebClient).toHaveBeenCalledWith('fake-bot-token', {
      logger: fakeAdapter,
    });
  });
});

describe('createSocketModeClient', () => {
  it('passes an adapter built from the given logger and token to the SocketModeClient constructor', () => {
    const logger = makeLogger();
    const fakeAdapter = { info: vi.fn() };
    mocks.createSdkLoggerAdapter.mockReturnValue(fakeAdapter);

    createSocketModeClient('fake-app-token', logger);

    expect(mocks.createSdkLoggerAdapter).toHaveBeenCalledWith(logger, [
      'fake-app-token',
    ]);
    expect(mocks.SocketModeClient).toHaveBeenCalledWith({
      appToken: 'fake-app-token',
      logger: fakeAdapter,
    });
  });
});
