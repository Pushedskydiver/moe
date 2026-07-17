import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from './main.js';

const VALID_ENV = {
  MOE_PERSONA_ID: 'sarah',
  MOE_SLACK_BOT_TOKEN: 'fake-bot-token',
  MOE_SLACK_SIGNING_SECRET: 'fake-signing-secret',
  MOE_SLACK_APP_TOKEN: 'fake-app-token',
  ANTHROPIC_API_KEY: 'sk-ant-fake-key',
  DATABASE_URL: 'postgres://postgres:password@localhost:5432/moe_dev',
  MOE_COST_CAP_MONTHLY: '50',
  MOE_COST_ALERT_SLACK_USER_ID: 'U0ALEX',
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

    const server = main(VALID_ENV, exit, vi.fn());
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
    const startSlack = vi.fn();

    const server = main(
      { MOE_SLACK_BOT_TOKEN: 'fake-leaked-value' },
      exit,
      startSlack,
    );

    expect(server).toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
    expect(startSlack).not.toHaveBeenCalled();
    const emitted = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as {
      message: string;
    };
    expect(emitted.message).toBe('invalid persona config');
  });

  it('logs an error and exits without starting a server when the anthropic config is invalid', () => {
    const exit = vi.fn();
    const startSlack = vi.fn();

    const server = main(
      { ...VALID_ENV, ANTHROPIC_API_KEY: undefined },
      exit,
      startSlack,
    );

    expect(server).toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
    expect(startSlack).not.toHaveBeenCalled();
    const emitted = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as {
      message: string;
    };
    expect(emitted.message).toBe('invalid anthropic config');
  });

  it('logs an error and exits without starting a server when the database config is invalid', () => {
    const exit = vi.fn();
    const startSlack = vi.fn();

    const server = main(
      { ...VALID_ENV, DATABASE_URL: undefined },
      exit,
      startSlack,
    );

    expect(server).toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
    expect(startSlack).not.toHaveBeenCalled();
    const emitted = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as {
      message: string;
    };
    expect(emitted.message).toBe('invalid database config');
  });

  it('logs an error and exits without starting a server when the cost cap config is invalid', () => {
    const exit = vi.fn();
    const startSlack = vi.fn();

    const server = main(
      { ...VALID_ENV, MOE_COST_CAP_MONTHLY: undefined },
      exit,
      startSlack,
    );

    expect(server).toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
    expect(startSlack).not.toHaveBeenCalled();
    const emitted = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as {
      message: string;
    };
    expect(emitted.message).toBe('invalid cost cap config');
  });

  it('logs an error and signals a failed exit when the HTTP server errors (e.g. port already in use)', async () => {
    const first = main(VALID_ENV, vi.fn(), vi.fn());
    const address = first?.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;

    const exit = vi.fn();
    await new Promise<void>((resolve) => {
      const second = main({ ...VALID_ENV, PORT: String(port) }, exit, vi.fn());
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

  it('starts the Slack listener with the parsed config, and its exit callback closes the HTTP server (so an exit actually takes effect instead of the listening server keeping the process alive forever)', async () => {
    const startSlack = vi.fn();
    const exit = vi.fn();

    const server = main(VALID_ENV, exit, startSlack);

    expect(startSlack).toHaveBeenCalledTimes(1);
    const [deps, , passedExit] = startSlack.mock.calls[0] as [
      {
        config: { id: string };
        anthropicApiKey: string;
        db: unknown;
        costCapConfig: {
          monthlyCapUsdMicros: number;
          alertSlackUserId: string;
        };
      },
      unknown,
      (code: number) => void,
    ];
    expect(deps.config.id).toBe('sarah');
    expect(deps.anthropicApiKey).toBe('sk-ant-fake-key');
    expect(deps.db).toBeDefined();
    expect(deps.costCapConfig).toEqual({
      monthlyCapUsdMicros: 50_000_000,
      alertSlackUserId: 'U0ALEX',
    });

    passedExit(1);

    expect(exit).toHaveBeenCalledWith(1);
    await vi.waitFor(() => expect(server?.listening).toBe(false));
  });

  it("its exit callback also closes the database pool (an open pg.Pool keeps the event loop alive the same way a listening server does, so leaving it open would silently reintroduce the 'exit never actually takes effect' bug)", async () => {
    const startSlack = vi.fn();
    const exit = vi.fn();

    main(VALID_ENV, exit, startSlack);

    const [deps, , passedExit] = startSlack.mock.calls[0] as [
      { db: { destroy: () => Promise<void> } },
      unknown,
      (code: number) => void,
    ];
    const destroySpy = vi.spyOn(deps.db, 'destroy');

    passedExit(1);

    await vi.waitFor(() => expect(destroySpy).toHaveBeenCalledTimes(1));
  });
});
