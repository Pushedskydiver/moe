import { describe, expect, it } from 'vitest';

import {
  isProcessableMessageEvent,
  rawSlackMessageEventSchema,
} from './raw-message-event.js';

const VALID_DM_EVENT = {
  type: 'message',
  channel: 'D123',
  channel_type: 'im',
  user: 'U123',
  text: 'hello',
  ts: '1700000000.000100',
} as const;

describe('rawSlackMessageEventSchema', () => {
  it('accepts a valid plain message event', () => {
    expect(rawSlackMessageEventSchema.safeParse(VALID_DM_EVENT).success).toBe(
      true,
    );
  });

  it('accepts a message event carrying a thread_ts', () => {
    const result = rawSlackMessageEventSchema.safeParse({
      ...VALID_DM_EVENT,
      thread_ts: '1699999999.000100',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-message event type', () => {
    const result = rawSlackMessageEventSchema.safeParse({
      ...VALID_DM_EVENT,
      type: 'reaction_added',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing channel or ts', () => {
    expect(
      rawSlackMessageEventSchema.safeParse({ type: 'message', channel: 'D123' })
        .success,
    ).toBe(false);
    expect(
      rawSlackMessageEventSchema.safeParse({ type: 'message', ts: '123.456' })
        .success,
    ).toBe(false);
  });

  it('accepts an event with bot_id and no user (a bot-authored message)', () => {
    const result = rawSlackMessageEventSchema.safeParse({
      type: 'message',
      channel: 'C123',
      channel_type: 'channel',
      bot_id: 'B123',
      text: 'I am a bot',
      ts: '1700000000.000100',
    });
    expect(result.success).toBe(true);
  });
});

describe('isProcessableMessageEvent', () => {
  it('returns true for a plain human-authored message with a known channel type', () => {
    expect(isProcessableMessageEvent(VALID_DM_EVENT)).toBe(true);
  });

  it('returns false when bot_id is present (avoids reply loops, including the bot replying to itself)', () => {
    expect(
      isProcessableMessageEvent({ ...VALID_DM_EVENT, bot_id: 'B123' }),
    ).toBe(false);
  });

  it('returns false when subtype is present (edits, deletes, joins, etc.)', () => {
    expect(
      isProcessableMessageEvent({
        ...VALID_DM_EVENT,
        subtype: 'message_changed',
      }),
    ).toBe(false);
  });

  it('returns false when user is missing', () => {
    expect(
      isProcessableMessageEvent({
        type: 'message',
        channel: 'D123',
        channel_type: 'im',
        text: 'hello',
        ts: '1700000000.000100',
      }),
    ).toBe(false);
  });

  it('returns false when channel_type is missing', () => {
    expect(
      isProcessableMessageEvent({
        type: 'message',
        channel: 'D123',
        user: 'U123',
        text: 'hello',
        ts: '1700000000.000100',
      }),
    ).toBe(false);
  });

  it('returns false when text is missing', () => {
    expect(
      isProcessableMessageEvent({
        type: 'message',
        channel: 'D123',
        channel_type: 'im',
        user: 'U123',
        ts: '1700000000.000100',
      }),
    ).toBe(false);
  });
});
