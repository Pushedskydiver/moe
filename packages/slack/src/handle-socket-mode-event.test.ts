import { describe, expect, it, vi } from 'vitest';

import { handleSocketModeEvent } from './handle-socket-mode-event.js';

function makeDeps(
  overrides: Partial<{
    readonly hasSeen: (eventId: string) => boolean;
  }> = {},
) {
  return {
    ack: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn(),
    logger: { warn: vi.fn() },
    seenEventCache: {
      hasSeen: vi.fn(overrides.hasSeen ?? (() => false)),
      markSeen: vi.fn(),
    },
  };
}

const VALID_EVENT = {
  type: 'message',
  channel: 'D123',
  channel_type: 'im',
  user: 'U123',
  text: 'hello',
  ts: '1700000000.000100',
};

describe('handleSocketModeEvent', () => {
  it('acks a valid event and calls onMessage with the normalized message', async () => {
    const deps = makeDeps();

    await handleSocketModeEvent(VALID_EVENT, 'Ev123', deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).toHaveBeenCalledWith({
      channelId: 'D123',
      channelType: 'im',
      userId: 'U123',
      text: 'hello',
      ts: '1700000000.000100',
    });
  });

  it('acks but does not call onMessage or warn for a bot-authored event', async () => {
    const deps = makeDeps();

    await handleSocketModeEvent(
      { ...VALID_EVENT, bot_id: 'B123' },
      'Ev123',
      deps,
    );

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
    expect(deps.logger.warn).not.toHaveBeenCalled();
  });

  it('acks but does not call onMessage for a subtyped event (edit/delete/join)', async () => {
    const deps = makeDeps();

    await handleSocketModeEvent(
      { ...VALID_EVENT, subtype: 'message_changed' },
      'Ev123',
      deps,
    );

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
  });

  it('acks and logs a warning, without calling onMessage, for a malformed event', async () => {
    const deps = makeDeps();

    await handleSocketModeEvent({ type: 'message' }, 'Ev123', deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('acks a completely unrelated payload without throwing', async () => {
    const deps = makeDeps();

    await expect(
      handleSocketModeEvent({ foo: 'bar' }, 'Ev123', deps),
    ).resolves.toBeUndefined();
    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
  });

  it("marks a new event id as seen before dispatching to onMessage (BUILD_PLAN follow-up on 3.4c's DA finding)", async () => {
    const deps = makeDeps();

    await handleSocketModeEvent(VALID_EVENT, 'Ev123', deps);

    expect(deps.seenEventCache.hasSeen).toHaveBeenCalledWith('Ev123');
    expect(deps.seenEventCache.markSeen).toHaveBeenCalledWith('Ev123');
  });

  it('acks but does not call onMessage or mark-seen-again for a redelivered event id already seen', async () => {
    const deps = makeDeps({ hasSeen: () => true });

    await handleSocketModeEvent(VALID_EVENT, 'Ev123', deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
    expect(deps.seenEventCache.markSeen).not.toHaveBeenCalled();
  });

  it('processes the event without consulting the dedup cache when no event id is available — fails open, not closed', async () => {
    const deps = makeDeps();

    await handleSocketModeEvent(VALID_EVENT, undefined, deps);

    expect(deps.onMessage).toHaveBeenCalledTimes(1);
    expect(deps.seenEventCache.hasSeen).not.toHaveBeenCalled();
    expect(deps.seenEventCache.markSeen).not.toHaveBeenCalled();
  });
});
