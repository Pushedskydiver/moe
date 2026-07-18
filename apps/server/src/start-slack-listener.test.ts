import type { StartSlackListenerDeps } from './start-slack-listener.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startSlackListener } from './start-slack-listener.js';

const mocks = vi.hoisted(() => ({
  createWebClient: vi.fn(),
  createSocketModeClient: vi.fn(),
  createSocketModeListener: vi.fn(),
  isUnrecoverableStartError: vi.fn(),
  createAnthropicClient: vi.fn(),
}));

vi.mock('@moe/slack', () => ({
  createWebClient: mocks.createWebClient,
  createSocketModeClient: mocks.createSocketModeClient,
  createSocketModeListener: mocks.createSocketModeListener,
  isUnrecoverableStartError: mocks.isUnrecoverableStartError,
}));
vi.mock('@moe/agents', () => ({
  createAnthropicClient: mocks.createAnthropicClient,
}));

afterEach(() => {
  vi.clearAllMocks();
});

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const DEPS: StartSlackListenerDeps = {
  config: {
    id: 'sarah' as const,
    slackBotToken: 'fake-bot-token',
    slackSigningSecret: 'fake-signing-secret',
    slackAppToken: 'fake-app-token',
  },
  anthropicApiKey: 'sk-ant-fake-key',
  // A placeholder — none of these tests exercise a Slack message reaching the handler, so the
  // real Kysely query surface is never touched; only its presence on `deps` is asserted anywhere.
  db: {} as StartSlackListenerDeps['db'],
  costCapConfig: {
    monthlyCapUsdMicros: 100_000_000,
    alertSlackUserId: 'U0ALEX',
  },
  channelScopeConfig: { workRelevantChannelIds: new Set(['C123']) },
};

function makeFakeListener(start: ReturnType<typeof vi.fn>) {
  return { start, disconnect: vi.fn() };
}

describe('startSlackListener', () => {
  it("constructs both Slack SDK clients with the persona's own tokens and the logger, and the Anthropic client with its own key", () => {
    const logger = makeLogger();
    mocks.createWebClient.mockReturnValue({ chat: {} });
    mocks.createSocketModeClient.mockReturnValue({});
    mocks.createAnthropicClient.mockReturnValue({ messages: {} });
    mocks.createSocketModeListener.mockReturnValue(
      makeFakeListener(vi.fn().mockResolvedValue(undefined)),
    );

    startSlackListener(DEPS, logger, vi.fn());

    expect(mocks.createWebClient).toHaveBeenCalledWith(
      'fake-bot-token',
      logger,
    );
    expect(mocks.createSocketModeClient).toHaveBeenCalledWith(
      'fake-app-token',
      logger,
    );
    expect(mocks.createAnthropicClient).toHaveBeenCalledWith(
      'sk-ant-fake-key',
      logger,
    );
  });

  it('wires the listener to the socket mode client and starts it', () => {
    const logger = makeLogger();
    const fakeSocketModeClient = {};
    const start = vi.fn().mockResolvedValue(undefined);
    mocks.createWebClient.mockReturnValue({ chat: {} });
    mocks.createSocketModeClient.mockReturnValue(fakeSocketModeClient);
    mocks.createAnthropicClient.mockReturnValue({ messages: {} });
    mocks.createSocketModeListener.mockReturnValue(makeFakeListener(start));

    startSlackListener(DEPS, logger, vi.fn());

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
    mocks.createAnthropicClient.mockReturnValue({ messages: {} });
    mocks.createSocketModeListener.mockReturnValue(
      makeFakeListener(vi.fn().mockRejectedValue(new Error('invalid_auth'))),
    );
    mocks.isUnrecoverableStartError.mockReturnValue(true);

    startSlackListener(DEPS, logger, exit);
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('does not call exit when the start failure is recoverable — the SDK auto-reconnects on its own', async () => {
    const logger = makeLogger();
    const exit = vi.fn();
    mocks.createWebClient.mockReturnValue({ chat: {} });
    mocks.createSocketModeClient.mockReturnValue({});
    mocks.createAnthropicClient.mockReturnValue({ messages: {} });
    mocks.createSocketModeListener.mockReturnValue(
      makeFakeListener(vi.fn().mockRejectedValue(new Error('transient'))),
    );
    mocks.isUnrecoverableStartError.mockReturnValue(false);

    startSlackListener(DEPS, logger, exit);
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());

    expect(exit).not.toHaveBeenCalled();
  });
});
