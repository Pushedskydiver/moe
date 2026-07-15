import { describe, expect, it, vi } from 'vitest';

import { main } from './main.js';

const VALID_ENV = {
  MOE_PERSONA_ID: 'sarah',
  MOE_SLACK_BOT_TOKEN: 'xoxb-real-token',
  MOE_SLACK_SIGNING_SECRET: 'real-signing-secret',
  PORT: '0',
};

describe('main', () => {
  it('boots an HTTP server that answers GET /health when the config is valid', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.fn();

    const server = main(VALID_ENV, exit);
    expect(server).toBeDefined();

    const address = server?.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await response.json()) as {
      status: string;
      personaId: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', personaId: 'sarah' });
    expect(exit).not.toHaveBeenCalled();

    server?.close();
    logSpy.mockRestore();
  });

  it('logs a redacted error and exits without starting a server when the config is invalid', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.fn();

    const server = main({ MOE_SLACK_BOT_TOKEN: 'xoxb-leaked' }, exit);

    expect(server).toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
    const emittedLines = logSpy.mock.calls.map((call) => call[0] as string);
    expect(emittedLines.some((line) => line.includes('xoxb-leaked'))).toBe(
      false,
    );

    logSpy.mockRestore();
  });
});
