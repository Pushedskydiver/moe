import { describe, expect, it } from 'vitest';

import { normalizeInboundReaction } from './normalize-inbound-reaction.js';

describe('normalizeInboundReaction', () => {
  it('maps a processable reaction_added event to an InboundReaction', () => {
    const result = normalizeInboundReaction({
      type: 'reaction_added',
      user: 'U123',
      reaction: 'white_check_mark',
      item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
      event_ts: '1700000001.000100',
    });

    expect(result).toEqual({
      reactionName: 'white_check_mark',
      userId: 'U123',
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });
  });
});
