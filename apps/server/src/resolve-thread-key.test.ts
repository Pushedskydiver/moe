import type { InboundMessage } from '@moe/slack';

import { describe, expect, it } from 'vitest';

import { resolveThreadKey } from './resolve-thread-key.js';

function dmMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    channelId: 'D123',
    channelType: 'im',
    userId: 'U1',
    text: 'hello',
    ts: '1000.0001',
    ...overrides,
  };
}

describe('resolveThreadKey', () => {
  it('returns a constant key for a DM message, regardless of threadTs', () => {
    expect(resolveThreadKey(dmMessage())).toBe('dm');
  });

  it('returns a constant key for a DM message even when it does have a threadTs', () => {
    expect(resolveThreadKey(dmMessage({ threadTs: '1000.0000' }))).toBe('dm');
  });

  it('returns the threadTs for an in-thread channel reply', () => {
    const message = dmMessage({
      channelType: 'channel',
      threadTs: '1000.0000',
    });
    expect(resolveThreadKey(message)).toBe('1000.0000');
  });

  it('returns the threadTs for an in-thread group reply', () => {
    const message = dmMessage({
      channelType: 'group',
      threadTs: '1000.0000',
    });
    expect(resolveThreadKey(message)).toBe('1000.0000');
  });

  it('returns undefined for an un-threaded channel message', () => {
    const message = dmMessage({ channelType: 'channel' });
    expect(resolveThreadKey(message)).toBeUndefined();
  });

  it('returns undefined for an un-threaded group message', () => {
    const message = dmMessage({ channelType: 'group' });
    expect(resolveThreadKey(message)).toBeUndefined();
  });
});
