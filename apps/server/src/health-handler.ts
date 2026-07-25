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
 * The only route the server exposes — GET /health returns 200 once a valid persona config is
 * loaded. The check proves the process booted and knows which persona it is; it deliberately does
 * *not* probe Slack or the database (BUILD_PLAN 2.2 was explicitly "connects nothing", and that
 * contract was kept at 5.2). A readiness probe would work against `main.ts`'s design, where an
 * unrecoverable Slack or GitHub failure closes the server and exits so Fly's supervisor restarts
 * the Machine — reporting unhealthy-but-alive is the exact state that exit path exists to avoid.
 * Everything else 404s.
 *
 * `personaId` in the body is what makes this a *per-persona* check across the eight Fly Apps of
 * BUILD_PLAN 5.2 — each App runs this same image with its own `[env] MOE_PERSONA_ID`, so the
 * response identifies which process answered. Reached over Fly's private network only (there is
 * no `[http_service]` section in `fly.<persona>.toml`); `fly checks list -a moe-<persona>` is the
 * operator-facing view.
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
