import { describe, expect, it } from 'vitest';

import { normalizeInboundMessage } from './normalize-inbound-message.js';

describe('normalizeInboundMessage', () => {
  it('maps a processable DM event to an InboundMessage', () => {
    const result = normalizeInboundMessage({
      type: 'message',
      channel: 'D123',
      channel_type: 'im',
      user: 'U123',
      text: 'hello',
      ts: '1700000000.000100',
    });

    expect(result).toEqual({
      channelId: 'D123',
      channelType: 'im',
      userId: 'U123',
      text: 'hello',
      ts: '1700000000.000100',
    });
  });

  it('carries threadTs through when the event is in a thread', () => {
    const result = normalizeInboundMessage({
      type: 'message',
      channel: 'C123',
      channel_type: 'channel',
      user: 'U123',
      text: 'reply',
      ts: '1700000000.000200',
      thread_ts: '1700000000.000100',
    });

    expect(result.threadTs).toBe('1700000000.000100');
  });

  it('omits threadTs when the event has no thread_ts', () => {
    const result = normalizeInboundMessage({
      type: 'message',
      channel: 'C123',
      channel_type: 'channel',
      user: 'U123',
      text: 'top-level',
      ts: '1700000000.000100',
    });

    expect(result.threadTs).toBeUndefined();
    expect('threadTs' in result).toBe(false);
  });
});
