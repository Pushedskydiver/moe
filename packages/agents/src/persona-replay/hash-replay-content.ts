import { createHash } from 'node:crypto';

/**
 * Deterministic SHA-256 hex digest, used as the persona-replay harness's staleness signal
 * (`docs/decisions/PERSONA-REPLAY-HARNESS.md` decision 3) — a fixture's stored hash of a
 * persona's `prompt.md` content and a scenario's own `input` are compared against a fresh hash
 * of the current values at replay-verification time.
 */
export function hashReplayContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
