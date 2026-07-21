import { describe, expect, it, vi } from 'vitest';

import { createAnthropicSdkLoggerAdapter } from './create-anthropic-sdk-logger-adapter.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createAnthropicSdkLoggerAdapter', () => {
  it('routes info/warn/error through the given logger with the first arg as the message', () => {
    const logger = makeLogger();
    const adapter = createAnthropicSdkLoggerAdapter(logger, []);

    adapter.info('request started');
    adapter.warn('deprecated model requested');
    adapter.error('request failed');

    expect(logger.info).toHaveBeenCalledWith('request started', {});
    expect(logger.warn).toHaveBeenCalledWith('deprecated model requested', {});
    expect(logger.error).toHaveBeenCalledWith('request failed', {});
  });

  it('never leaks a raw, unredacted line to console — everything goes through the injected logger', () => {
    const logger = makeLogger();
    const adapter = createAnthropicSdkLoggerAdapter(logger, []);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    adapter.error('request failed', 'some detail');

    expect(logSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('request failed', {
      details: ['some detail'],
    });

    logSpy.mockRestore();
  });

  it('redacts a known secret value wherever it appears in the message, not just by key name', () => {
    const logger = makeLogger();
    const adapter = createAnthropicSdkLoggerAdapter(logger, [
      'sk-ant-real-secret',
    ]);

    adapter.error('request failed (Authorization: Bearer sk-ant-real-secret)');

    expect(logger.error).toHaveBeenCalledWith(
      'request failed (Authorization: Bearer [REDACTED])',
      {},
    );
  });

  it('redacts every secret in a multi-secret list, not just the first', () => {
    const logger = makeLogger();
    const adapter = createAnthropicSdkLoggerAdapter(logger, [
      'sk-ant-real-secret-one',
      'sk-ant-real-secret-two',
    ]);

    adapter.error(
      'primary=sk-ant-real-secret-one fallback=sk-ant-real-secret-two',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'primary=[REDACTED] fallback=[REDACTED]',
      {},
    );
  });

  it('redacts a known secret value inside a positional rest argument', () => {
    const logger = makeLogger();
    const adapter = createAnthropicSdkLoggerAdapter(logger, [
      'sk-ant-real-secret',
    ]);

    adapter.warn('retrying request', 'x-api-key: sk-ant-real-secret');

    expect(logger.warn).toHaveBeenCalledWith('retrying request', {
      details: ['x-api-key: [REDACTED]'],
    });
  });

  it('flattens an Error argument to its message, not the raw Error object', () => {
    const logger = makeLogger();
    const adapter = createAnthropicSdkLoggerAdapter(logger, []);

    adapter.error('request blew up', new Error('ECONNRESET'));

    expect(logger.error).toHaveBeenCalledWith('request blew up', {
      details: ['ECONNRESET'],
    });
  });

  it('silences debug (too noisy for production)', () => {
    const logger = makeLogger();
    const adapter = createAnthropicSdkLoggerAdapter(logger, []);

    expect(() => adapter.debug('noisy internals')).not.toThrow();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
