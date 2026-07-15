import { describe, expect, it, vi } from 'vitest';

import { handleSocketModeEvent } from './handle-socket-mode-event.js';

function makeDeps() {
  return {
    ack: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn(),
    logger: { warn: vi.fn() },
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

    await handleSocketModeEvent(VALID_EVENT, deps);

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

    await handleSocketModeEvent({ ...VALID_EVENT, bot_id: 'B123' }, deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
    expect(deps.logger.warn).not.toHaveBeenCalled();
  });

  it('acks but does not call onMessage for a subtyped event (edit/delete/join)', async () => {
    const deps = makeDeps();

    await handleSocketModeEvent(
      { ...VALID_EVENT, subtype: 'message_changed' },
      deps,
    );

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
  });

  it('acks and logs a warning, without calling onMessage, for a malformed event', async () => {
    const deps = makeDeps();

    await handleSocketModeEvent({ type: 'message' }, deps);

    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('acks a completely unrelated payload without throwing', async () => {
    const deps = makeDeps();

    await expect(
      handleSocketModeEvent({ foo: 'bar' }, deps),
    ).resolves.toBeUndefined();
    expect(deps.ack).toHaveBeenCalledTimes(1);
    expect(deps.onMessage).not.toHaveBeenCalled();
  });
});
