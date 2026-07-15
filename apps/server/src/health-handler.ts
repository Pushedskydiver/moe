import type { PersonaConfig } from '@moe/agents';
import type { IncomingMessage, ServerResponse } from 'node:http';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

function respondJson(
  res: ServerResponse,
  statusCode: number,
  body: Readonly<Record<string, unknown>>,
): void {
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

/**
 * The only route this chunk exposes — GET /health returns 200 once a valid persona config is
 * loaded (the health check proves the process booted, not that anything downstream is connected;
 * BUILD_PLAN 2.2 is explicitly "connects nothing"). Everything else 404s.
 */
export function createHealthHandler(
  config: PersonaConfig,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const isHealthCheck = req.method === 'GET' && req.url === '/health';
    if (!isHealthCheck) {
      respondJson(res, 404, { status: 'not-found' });
      return;
    }
    respondJson(res, 200, { status: 'ok', personaId: config.id });
  };
}
