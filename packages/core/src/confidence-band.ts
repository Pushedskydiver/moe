/**
 * VISION §5.2's three-band routing outcome, `docs/decisions/STAGE-1-CLASSIFIER.md`'s thresholds
 * (calibrated against a real 24-message eval, not chosen from theory): High >= 70 auto-drafts a
 * ticket (BUILD_PLAN 3.4a-i); Mid 35-69 asks a confirming question (3.4b-i); Low < 35 logs silently
 * to the review queue on an ambient message (3.4c), and on a DM simply falls through to the ordinary
 * conversational reply with no review-queue row at all (3.7 — the reply is itself the "nothing is
 * silently eaten" outcome, so logging it too would only bury the 3.5 sweep digest in chatter). The Low ceiling is a strict `< 35`, not `<= 35` — the ADR's own
 * Decision 3 deliberately lands its one boundary case (a score of exactly 35) in Mid, not Low.
 */
export type ConfidenceBand = 'high' | 'mid' | 'low';

const HIGH_THRESHOLD = 70;
const MID_THRESHOLD = 35;

export function classifyConfidenceBand(score: number): ConfidenceBand {
  if (score >= HIGH_THRESHOLD) return 'high';
  if (score >= MID_THRESHOLD) return 'mid';
  return 'low';
}
