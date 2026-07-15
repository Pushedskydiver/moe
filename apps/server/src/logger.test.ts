import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from './logger.js';

describe('createLogger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits a single structured JSON line with level and message', () => {
    const logger = createLogger({ secretKeys: [] });

    logger.info('server started');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const emitted = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;
    expect(emitted.level).toBe('info');
    expect(emitted.message).toBe('server started');
    expect(typeof emitted.timestamp).toBe('string');
  });

  it('includes extra fields in the emitted line', () => {
    const logger = createLogger({ secretKeys: [] });

    logger.info('booted', { personaId: 'sarah', port: 3000 });

    const emitted = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;
    expect(emitted.personaId).toBe('sarah');
    expect(emitted.port).toBe(3000);
  });

  it('redacts configured secret keys, even nested, and never emits the raw value', () => {
    const logger = createLogger({ secretKeys: ['slackBotToken'] });

    logger.error('boot failed', {
      config: { id: 'sarah', slackBotToken: 'xoxb-super-secret' },
    });

    const rawLine = logSpy.mock.calls[0]?.[0] as string;
    expect(rawLine).not.toContain('xoxb-super-secret');
    const emitted = JSON.parse(rawLine) as {
      config: { slackBotToken: string };
    };
    expect(emitted.config.slackBotToken).toBe('[REDACTED]');
  });

  it('supports warn and error levels', () => {
    const logger = createLogger({ secretKeys: [] });

    logger.warn('degraded');
    logger.error('failed');

    expect(
      (JSON.parse(logSpy.mock.calls[0]?.[0] as string) as { level: string })
        .level,
    ).toBe('warn');
    expect(
      (JSON.parse(logSpy.mock.calls[1]?.[0] as string) as { level: string })
        .level,
    ).toBe('error');
  });
});
