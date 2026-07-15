import { afterEach, describe, expect, it, vi } from 'vitest';

import { startSlackListener } from './start-slack-listener.js';

const mocks = vi.hoisted(() => ({
  createWebClient: vi.fn(),
  createSocketModeClient: vi.fn(),
  createSocketModeListener: vi.fn(),
  isUnrecoverableStartError: vi.fn(),
}));

vi.mock('@moe/slack', () => mocks);

afterEach(() => {
  vi.clearAllMocks();
});

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const CONFIG = {
  id: 'sarah' as const,
  slackBotToken: 'fake-bot-token',
  slackSigningSecret: 'fake-signing-secret',
  slackAppToken: 'fake-app-token',
};

function makeFakeListener(start: ReturnType<typeof vi.fn>) {
  return { start, disconnect: vi.fn() };
}

describe('startSlackListener', () => {
  it("constructs both SDK clients with the persona's own tokens and the logger", () => {
    const logger = makeLogger();
    const fakeWebClient = { chat: {} };
    const fakeSocketModeClient = {};
    mocks.createWebClient.mockReturnValue(fakeWebClient);
    mocks.createSocketModeClient.mockReturnValue(fakeSocketModeClient);
    mocks.createSocketModeListener.mockReturnValue(
      makeFakeListener(vi.fn().mockResolvedValue(undefined)),
    );

    startSlackListener(CONFIG, logger, vi.fn());

    expect(mocks.createWebClient).toHaveBeenCalledWith(
      'fake-bot-token',
      logger,
    );
    expect(mocks.createSocketModeClient).toHaveBeenCalledWith(
      'fake-app-token',
      logger,
    );
  });

  it('wires the listener to the socket mode client and starts it', () => {
    const logger = makeLogger();
    const fakeSocketModeClient = {};
    const start = vi.fn().mockResolvedValue(undefined);
    mocks.createWebClient.mockReturnValue({ chat: {} });
    mocks.createSocketModeClient.mockReturnValue(fakeSocketModeClient);
    mocks.createSocketModeListener.mockReturnValue(makeFakeListener(start));

    startSlackListener(CONFIG, logger, vi.fn());

    expect(mocks.createSocketModeListener).toHaveBeenCalledWith(
      fakeSocketModeClient,
      expect.objectContaining({ logger, onMessage: expect.any(Function) }),
    );
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('calls exit(1) when the start failure is unrecoverable (matches isUnrecoverableStartError)', async () => {
    const logger = makeLogger();
    const exit = vi.fn();
    mocks.createWebClient.mockReturnValue({ chat: {} });
    mocks.createSocketModeClient.mockReturnValue({});
    mocks.createSocketModeListener.mockReturnValue(
      makeFakeListener(vi.fn().mockRejectedValue(new Error('invalid_auth'))),
    );
    mocks.isUnrecoverableStartError.mockReturnValue(true);

    startSlackListener(CONFIG, logger, exit);
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('does not call exit when the start failure is recoverable — the SDK auto-reconnects on its own', async () => {
    const logger = makeLogger();
    const exit = vi.fn();
    mocks.createWebClient.mockReturnValue({ chat: {} });
    mocks.createSocketModeClient.mockReturnValue({});
    mocks.createSocketModeListener.mockReturnValue(
      makeFakeListener(vi.fn().mockRejectedValue(new Error('transient'))),
    );
    mocks.isUnrecoverableStartError.mockReturnValue(false);

    startSlackListener(CONFIG, logger, exit);
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());

    expect(exit).not.toHaveBeenCalled();
  });
});
