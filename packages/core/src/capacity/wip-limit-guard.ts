import type { BoardStatus } from '../board-status.js';
import type { WipLimitsConfig } from './wip-limits-config.js';

import { DEFAULT_WIP_LIMITS } from './wip-limits-config.js';

export type WipLimitReason = 'under-limit' | 'at-limit' | 'uncapped-status';

export type WipLimitDecision = {
  readonly allowed: boolean;
  readonly reason: WipLimitReason;
};

/**
 * BUILD_PLAN 4.5's WIP-limit guard — pure and synchronous, like `../risk-tier.js`'s
 * `classifyRiskTier`, not `evaluateOperatingRhythm`'s async/cache-consulting shape: nothing yet
 * produces a live per-status count (BUILD_PLAN 6.1a-i's pull loop fetches per-*stage* claim
 * candidates via `listClaimableTickets`, not a full per-status tally across the board), so this
 * function takes an already-known `currentCount` rather than querying the database itself. **No
 * call site yet** — BUILD_PLAN 6.1a-ii ("Stage transitions + WIP gate") is where a real pull-time
 * check wires this in, same "ship the primitive ahead of its call site" shape
 * `composeExternalPostBody` (chunk 4.4a) had before 4.4b wired it in.
 *
 * Deliberately scoped to the WIP *cap* only — `classOfService`'s Expedite queue-*ordering*
 * behavior (`docs/decisions/BOARD-AND-CAPACITY-MODEL.md` Decision 2, "jumps ahead of Standard
 * work within its board status") is a different concern this function doesn't address.
 * BUILD_PLAN 6.1a-i's own `findNextClaimableTicket` (`./find-next-claimable-ticket.js`) now
 * covers that gap, picking the next candidate among an already-fetched, already-WIP-filtered set
 * — a separate function from this cap guard, not a replacement for it.
 */
export function evaluateWipLimit(
  status: BoardStatus,
  currentCount: number,
  limits: WipLimitsConfig = DEFAULT_WIP_LIMITS,
): WipLimitDecision {
  const limit = limits[status];
  if (limit === null) return { allowed: true, reason: 'uncapped-status' };

  if (currentCount >= limit) return { allowed: false, reason: 'at-limit' };
  return { allowed: true, reason: 'under-limit' };
}
