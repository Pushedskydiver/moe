import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from './main.js';

const VALID_ENV = {
  MOE_PERSONA_ID: 'sarah',
  MOE_SLACK_BOT_TOKEN: 'fake-bot-token',
  MOE_SLACK_SIGNING_SECRET: 'fake-signing-secret',
  PORT: '0',
};

describe('main', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('boots an HTTP server that answers GET /health when the config is valid', async () => {
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
  });

  it('logs an error and exits without starting a server when the config is invalid', () => {
    const exit = vi.fn();

    const server = main({ MOE_SLACK_BOT_TOKEN: 'fake-leaked-value' }, exit);

    expect(server).toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
    const emitted = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as {
      message: string;
    };
    expect(emitted.message).toBe('invalid persona config');
  });

  it('logs an error and signals a failed exit when the HTTP server errors (e.g. port already in use)', async () => {
    const first = main(VALID_ENV, vi.fn());
    const address = first?.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;

    const exit = vi.fn();
    await new Promise<void>((resolve) => {
      const second = main({ ...VALID_ENV, PORT: String(port) }, exit);
      second?.on('error', () => resolve());
    });

    expect(exit).toHaveBeenCalledWith(1);
    const emitted = logSpy.mock.calls.map(
      (call: unknown[]) => JSON.parse(call[0] as string) as { message: string },
    );
    expect(
      emitted.some(
        (line: { message: string }) => line.message === 'server error',
      ),
    ).toBe(true);

    first?.close();
  });
});
