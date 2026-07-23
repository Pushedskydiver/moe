import type { BoardStatus } from '../board-status.js';

/**
 * VISION §3.1/§3.4's capacity model, settled at BUILD_PLAN chunk 4.3
 * (`docs/decisions/BOARD-AND-CAPACITY-MODEL.md`) — a per-status cap on tickets simultaneously
 * held in that stage. `null` means uncapped, not "no limit configured" — every `BoardStatus` is
 * listed explicitly so a future status added to `board-status.ts` fails to compile here until
 * someone decides whether it's capped, rather than silently defaulting to uncapped.
 */
export type WipLimitsConfig = Readonly<Record<BoardStatus, number | null>>;

/**
 * Small starting caps, revisable once real throughput data exists — no persona beyond Sarah's
 * intake exists yet to generate any (`docs/decisions/BOARD-AND-CAPACITY-MODEL.md` Decision 4,
 * same "reasoned starting number, no calibration data yet" logic the 1.5 ADR's N=5 threshold
 * used). Backlog is a queue and Done/Cancelled are terminal states — none need a ceiling.
 */
export const DEFAULT_WIP_LIMITS: WipLimitsConfig = {
  Backlog: null,
  Brief: 3,
  Plan: 2,
  Build: 2,
  Review: 2,
  Done: null,
  Cancelled: null,
};
