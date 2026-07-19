import { describe, expect, it, vi } from 'vitest';

import { handleSocketModeReactionEvent } from './handle-socket-mode-reaction-event.js';

function makeDeps(
  botUserId = 'UBOTSARAH',
  overrides: Partial<{
    readonly hasSeen: (eventId: string) => boolean;
  }> = {},
) {
  return {
    ack: vi.fn().mockResolvedValue(undefined),
    onReactionAdded: vi.fn(),
    botUserId,
    logger: { warn: vi.fn() },
    seenEventCache: {
      hasSeen: vi.fn(overrides.hasSeen ?? (() => false)),
      markSeen: vi.fn(),
      forget: vi.fn(),
    },
  };
}

const VALID_EVENT = {
  type: 'reaction_added',
  user: 'U123',
  reaction: 'white_check_mark',
  item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
  event_ts: '1700000000.000200',
};

describe('handleSocketModeReactionEvent', () => {
  it('acks a valid event and calls onReactionAdded with the normalized reaction', async () => {
    const deps = makeDeps();

    await handleSocketModeReactionEvent(VALID_EVENT, 'Ev123', deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onReactionAdded).toHaveBeenCalledWith({
      reactionName: 'white_check_mark',
      userId: 'U123',
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });
  });

  it('acks but does not call onReactionAdded for a self-authored reaction — this persona reacting to its own posted draft (BUILD_PLAN 3.4a-iii)', async () => {
    const deps = makeDeps('U123');

    await handleSocketModeReactionEvent(VALID_EVENT, 'Ev123', deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onReactionAdded).not.toHaveBeenCalled();
    expect(deps.logger.warn).not.toHaveBeenCalled();
  });

  it('acks but does not call onReactionAdded for a reaction on a non-message item', async () => {
    const deps = makeDeps();

    await handleSocketModeReactionEvent(
      { ...VALID_EVENT, item: { ...VALID_EVENT.item, type: 'file' } },
      'Ev123',
      deps,
    );

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onReactionAdded).not.toHaveBeenCalled();
  });

  it('acks and logs a warning, without calling onReactionAdded, for a malformed event', async () => {
    const deps = makeDeps();

    await handleSocketModeReactionEvent(
      { type: 'reaction_added' },
      'Ev123',
      deps,
    );

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onReactionAdded).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('acks a completely unrelated payload without throwing', async () => {
    const deps = makeDeps();

    await expect(
      handleSocketModeReactionEvent({ foo: 'bar' }, 'Ev123', deps),
    ).resolves.toBeUndefined();
    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onReactionAdded).not.toHaveBeenCalled();
  });

  it("marks a new event id as seen before dispatching to onReactionAdded, not after — closes the 🔁-redo double-fire gap 3.4c's own DA review found", async () => {
    const deps = makeDeps();

    await handleSocketModeReactionEvent(VALID_EVENT, 'Ev123', deps);

    expect(deps.seenEventCache.hasSeen).toHaveBeenCalledWith('Ev123');
    expect(deps.seenEventCache.markSeen).toHaveBeenCalledWith('Ev123');
    const markSeenOrder =
      deps.seenEventCache.markSeen.mock.invocationCallOrder[0];
    const onReactionAddedOrder =
      deps.onReactionAdded.mock.invocationCallOrder[0];
    expect(markSeenOrder).toBeLessThan(onReactionAddedOrder);
  });

  it('acks but does not call onReactionAdded or mark-seen-again for a redelivered event id already seen', async () => {
    const deps = makeDeps('UBOTSARAH', { hasSeen: () => true });

    await handleSocketModeReactionEvent(VALID_EVENT, 'Ev123', deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onReactionAdded).not.toHaveBeenCalled();
    expect(deps.seenEventCache.markSeen).not.toHaveBeenCalled();
  });

  it('processes the event without consulting the dedup cache when no event id is available — fails open, not closed', async () => {
    const deps = makeDeps();

    await handleSocketModeReactionEvent(VALID_EVENT, undefined, deps);

    expect(deps.onReactionAdded).toHaveBeenCalledTimes(1);
    expect(deps.seenEventCache.hasSeen).not.toHaveBeenCalled();
    expect(deps.seenEventCache.markSeen).not.toHaveBeenCalled();
  });
});
