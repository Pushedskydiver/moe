import type { ClassOfService } from './class-of-service.js';
import type { Severity } from './severity.js';

import { INCIDENTS_CHANNEL_ID } from './channel-scoping/incidents-channel-id.js';

/**
 * `docs/decisions/BOARD-AND-CAPACITY-MODEL.md` Decision 2, implemented verbatim: "Expedite =
 * anything from `#moe-incidents`... or `severity: 'Critical'`" — an OR, not an XOR, so a ticket
 * matching both conditions is still just `'Expedite'`.
 *
 * The `severity`-based branch is correct per the ADR but currently unreachable in production:
 * `severity` is itself a separate, unrelated, still-hardcoded `'Medium'` placeholder everywhere a
 * ticket is created (Decision 3's own explicit deferral) — no live path ever assigns
 * `'Critical'`. Only the channel-based branch is live today.
 */
export function classifyClassOfService(
  input: { readonly channelId: string; readonly severity: Severity },
  incidentsChannelId: string = INCIDENTS_CHANNEL_ID,
): ClassOfService {
  if (input.channelId === incidentsChannelId || input.severity === 'Critical') {
    return 'Expedite';
  }
  return 'Standard';
}
