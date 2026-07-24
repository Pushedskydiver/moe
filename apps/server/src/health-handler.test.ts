import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createHealthHandler } from './health-handler.js';

function makeMockResponse() {
  const res = {
    writeHead: vi.fn(),
    end: vi.fn(),
  };
  return res as unknown as ServerResponse & typeof res;
}

function makeMockRequest(method: string, url: string): IncomingMessage {
  return { method, url } as IncomingMessage;
}

describe('createHealthHandler', () => {
  it('responds 200 with a JSON status body for GET /health', () => {
    const handler = createHealthHandler({
      id: 'sarah',
      slackBotToken: 'fake-bot-token',
      slackSigningSecret: 'test-secret',
      slackAppToken: 'fake-app-token',
    });
    const res = makeMockResponse();

    handler(makeMockRequest('GET', '/health'), res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'content-type': 'application/json',
    });
    const body = JSON.parse(res.end.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;
    expect(body.status).toBe('ok');
    expect(body.personaId).toBe('sarah');
  });

  it('reports the running process’s own persona, not a hardcoded one', () => {
    // BUILD_PLAN 5.2: eight Fly Apps run this same image, each pinned to its own persona via
    // `[env] MOE_PERSONA_ID`. `fly checks list -a moe-<persona>` is only a per-persona signal if
    // the body actually reflects that process's config, so a non-Sarah case pins it.
    const handler = createHealthHandler({
      id: 'maya',
      slackBotToken: 'fake-bot-token',
      slackSigningSecret: 'test-secret',
      slackAppToken: 'fake-app-token',
    });
    const res = makeMockResponse();

    handler(makeMockRequest('GET', '/health'), res);

    const body = JSON.parse(res.end.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;
    expect(body.personaId).toBe('maya');
  });

  it('responds 404 for any other path', () => {
    const handler = createHealthHandler({
      id: 'sarah',
      slackBotToken: 'fake-bot-token',
      slackSigningSecret: 'test-secret',
      slackAppToken: 'fake-app-token',
    });
    const res = makeMockResponse();

    handler(makeMockRequest('GET', '/unknown'), res);

    expect(res.writeHead).toHaveBeenCalledWith(404, {
      'content-type': 'application/json',
    });
  });

  it('responds 404 for a non-GET request to /health', () => {
    const handler = createHealthHandler({
      id: 'sarah',
      slackBotToken: 'fake-bot-token',
      slackSigningSecret: 'test-secret',
      slackAppToken: 'fake-app-token',
    });
    const res = makeMockResponse();

    handler(makeMockRequest('POST', '/health'), res);

    expect(res.writeHead).toHaveBeenCalledWith(404, {
      'content-type': 'application/json',
    });
  });
});
