import { Anthropic } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { createAnthropicClient } from './create-anthropic-client.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createAnthropicClient', () => {
  it('returns an Anthropic client instance', () => {
    const client = createAnthropicClient('sk-ant-fake-key', makeLogger());

    expect(client).toBeInstanceOf(Anthropic);
  });

  it('overrides the SDK default 10-minute timeout with a value fitting a chat-turn latency target', () => {
    const client = createAnthropicClient('sk-ant-fake-key', makeLogger());

    expect(client.timeout).toBeLessThan(60_000);
  });

  it('routes the SDK logger through the given logger, redacting the API key — never falls back to the SDK default console logger', () => {
    const logger = makeLogger();
    const client = createAnthropicClient('sk-ant-fake-key', logger);

    client.logger.warn('retrying request', 'x-api-key: sk-ant-fake-key');

    expect(logger.warn).toHaveBeenCalledWith('retrying request', {
      details: ['x-api-key: [REDACTED]'],
    });
  });
});
