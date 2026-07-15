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
