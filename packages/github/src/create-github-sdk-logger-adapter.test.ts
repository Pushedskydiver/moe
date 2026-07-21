import { describe, expect, it, vi } from 'vitest';

import { createGithubSdkLoggerAdapter } from './create-github-sdk-logger-adapter.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createGithubSdkLoggerAdapter', () => {
  it('routes info/warn/error through the given logger', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, []);

    adapter.info('request succeeded');
    adapter.warn('rate limit approaching');
    adapter.error('request failed');

    expect(logger.info).toHaveBeenCalledWith('request succeeded', {});
    expect(logger.warn).toHaveBeenCalledWith('rate limit approaching', {});
    expect(logger.error).toHaveBeenCalledWith('request failed', {});
  });

  it('never leaks a raw, unredacted line to console — everything goes through the injected logger', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, []);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    adapter.error('request failed', 'some detail');

    expect(logSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('request failed', {
      details: ['some detail'],
    });

    logSpy.mockRestore();
  });

  it('redacts a known secret value wherever it appears in the message', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, [
      'ghs_real-installation-token',
    ]);

    adapter.error(
      'request failed (Authorization: Bearer ghs_real-installation-token)',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'request failed (Authorization: Bearer [REDACTED])',
      {},
    );
  });

  it('redacts every secret in a multi-secret list via the static list alone, not just the first — values deliberately shaped so GITHUB_TOKEN_PATTERN cannot also catch them, isolating this from the pattern-based redaction covered elsewhere', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, [
      'super-secret-one',
      'super-secret-two',
    ]);

    adapter.error('first=super-secret-one second=super-secret-two');

    expect(logger.error).toHaveBeenCalledWith(
      'first=[REDACTED] second=[REDACTED]',
      {},
    );
  });

  it('redacts a known secret value inside the additionalInfo argument', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, [
      'ghs_real-installation-token',
    ]);

    adapter.warn(
      'retrying request',
      'Authorization: Bearer ghs_real-installation-token',
    );

    expect(logger.warn).toHaveBeenCalledWith('retrying request', {
      details: ['Authorization: Bearer [REDACTED]'],
    });
  });

  it('redacts a GitHub-token-shaped string even when it was never passed in secretValues (the live-minted installation token, unknown at client-construction time)', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, []);

    adapter.error(
      'request failed (Authorization: token ghs_FAKEtestTokenNotARealSecret123)',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'request failed (Authorization: token [REDACTED])',
      {},
    );
  });

  it('flattens an Error argument to its message, not the raw Error object', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, []);

    adapter.error('request threw', new Error('ECONNRESET'));

    expect(logger.error).toHaveBeenCalledWith('request threw', {
      details: ['ECONNRESET'],
    });
  });

  it('silences debug (too noisy for production)', () => {
    const logger = makeLogger();
    const adapter = createGithubSdkLoggerAdapter(logger, []);

    expect(() => adapter.debug('noisy internals')).not.toThrow();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
