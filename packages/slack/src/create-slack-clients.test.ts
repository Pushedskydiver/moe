import { WebClient } from '@slack/web-api';
import { describe, expect, it, vi } from 'vitest';

import {
  createSocketModeClient,
  createWebClient,
} from './create-slack-clients.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createWebClient', () => {
  it('builds a WebClient authenticated with the given bot token', () => {
    const client = createWebClient('fake-bot-token');

    expect(client).toBeInstanceOf(WebClient);
    expect(client.token).toBe('fake-bot-token');
  });
});

describe('createSocketModeClient', () => {
  it('builds a client exposing the start/disconnect/on surface createSocketModeListener needs', () => {
    const client = createSocketModeClient('fake-app-token', makeLogger());

    expect(typeof client.start).toBe('function');
    expect(typeof client.disconnect).toBe('function');
    expect(typeof client.on).toBe('function');
  });
});
