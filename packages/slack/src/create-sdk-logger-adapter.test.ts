import { describe, expect, it, vi } from 'vitest';

import { createSdkLoggerAdapter } from './create-sdk-logger-adapter.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createSdkLoggerAdapter', () => {
  it('routes info/warn/error through the given logger with the first arg as the message', () => {
    const logger = makeLogger();
    const adapter = createSdkLoggerAdapter(logger, []);

    adapter.info('connected');
    adapter.warn('reconnecting');
    adapter.error('failed to retrieve a new WSS URL');

    expect(logger.info).toHaveBeenCalledWith('connected', {});
    expect(logger.warn).toHaveBeenCalledWith('reconnecting', {});
    expect(logger.error).toHaveBeenCalledWith(
      'failed to retrieve a new WSS URL',
      {},
    );
  });

  it('never leaks a raw, unredacted line to console — everything goes through the injected logger', () => {
    const logger = makeLogger();
    const adapter = createSdkLoggerAdapter(logger, []);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    adapter.error('token rejected', 'some detail');

    expect(logSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('token rejected', {
      details: ['some detail'],
    });

    logSpy.mockRestore();
  });

  it('redacts a known secret value wherever it appears in the message, not just by key name', () => {
    const logger = makeLogger();
    const adapter = createSdkLoggerAdapter(logger, ['xapp-real-secret']);

    adapter.error(
      'Failed to retrieve a new WSS URL (error: invalid token xapp-real-secret)',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to retrieve a new WSS URL (error: invalid token [REDACTED])',
      {},
    );
  });

  it('redacts every secret in a multi-secret list, not just the first', () => {
    const logger = makeLogger();
    const adapter = createSdkLoggerAdapter(logger, [
      'xoxb-real-bot-token',
      'xapp-real-app-token',
    ]);

    adapter.error('bot=xoxb-real-bot-token app=xapp-real-app-token');

    expect(logger.error).toHaveBeenCalledWith(
      'bot=[REDACTED] app=[REDACTED]',
      {},
    );
  });

  it('redacts a known secret value inside a positional detail argument (the key-based redactSecrets bypass this exists to close)', () => {
    const logger = makeLogger();
    const adapter = createSdkLoggerAdapter(logger, ['xoxb-real-secret']);

    adapter.warn(
      'http request failed',
      'Authorization: Bearer xoxb-real-secret',
    );

    expect(logger.warn).toHaveBeenCalledWith('http request failed', {
      details: ['Authorization: Bearer [REDACTED]'],
    });
  });

  it('flattens an Error argument to its message, not the raw Error object', () => {
    const logger = makeLogger();
    const adapter = createSdkLoggerAdapter(logger, []);

    adapter.error('websocket blew up', new Error('ECONNRESET'));

    expect(logger.error).toHaveBeenCalledWith('websocket blew up', {
      details: ['ECONNRESET'],
    });
  });

  it('silences debug (too noisy for production) and no-ops the level/name setters', () => {
    const logger = makeLogger();
    const adapter = createSdkLoggerAdapter(logger, []);

    expect(() => adapter.debug('noisy internals')).not.toThrow();
    expect(() => adapter.setLevel('debug' as never)).not.toThrow();
    expect(() => adapter.setName('socket-mode')).not.toThrow();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
