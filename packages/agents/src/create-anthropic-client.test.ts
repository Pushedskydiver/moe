import { Anthropic } from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import { createAnthropicClient } from './create-anthropic-client.js';

describe('createAnthropicClient', () => {
  it('returns an Anthropic client instance', () => {
    const client = createAnthropicClient('sk-ant-fake-key');

    expect(client).toBeInstanceOf(Anthropic);
  });

  it('overrides the SDK default 10-minute timeout with a value fitting a chat-turn latency target', () => {
    const client = createAnthropicClient('sk-ant-fake-key');

    expect(client.timeout).toBeLessThan(60_000);
  });
});
