import { describe, expect, it } from 'vitest';

import {
  isProcessableReactionEvent,
  rawSlackReactionEventSchema,
} from './raw-reaction-event.js';

const VALID_REACTION_EVENT = {
  type: 'reaction_added',
  user: 'U123',
  reaction: 'white_check_mark',
  item: {
    type: 'message',
    channel: 'C123',
    ts: '1700000000.000100',
  },
  event_ts: '1700000001.000100',
} as const;

describe('rawSlackReactionEventSchema', () => {
  it('accepts a valid reaction_added event', () => {
    expect(
      rawSlackReactionEventSchema.safeParse(VALID_REACTION_EVENT).success,
    ).toBe(true);
  });

  it('rejects a non-reaction_added event type', () => {
    const result = rawSlackReactionEventSchema.safeParse({
      ...VALID_REACTION_EVENT,
      type: 'reaction_removed',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing item.channel or item.ts', () => {
    const result = rawSlackReactionEventSchema.safeParse({
      ...VALID_REACTION_EVENT,
      item: { type: 'message' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing reaction or user', () => {
    const withoutReaction: Record<string, unknown> = {
      ...VALID_REACTION_EVENT,
    };
    delete withoutReaction.reaction;
    const result = rawSlackReactionEventSchema.safeParse(withoutReaction);
    expect(result.success).toBe(false);
  });
});

describe('isProcessableReactionEvent', () => {
  it('is true for a reaction on a message-type item', () => {
    const parsed = rawSlackReactionEventSchema.parse(VALID_REACTION_EVENT);
    expect(isProcessableReactionEvent(parsed)).toBe(true);
  });

  it('is false for a reaction on a non-message item (e.g. a file)', () => {
    const parsed = rawSlackReactionEventSchema.parse({
      ...VALID_REACTION_EVENT,
      item: { type: 'file', channel: 'C123', ts: '1700000000.000100' },
    });
    expect(isProcessableReactionEvent(parsed)).toBe(false);
  });
});
