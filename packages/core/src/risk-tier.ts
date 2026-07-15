const TRACK_RECORD_THRESHOLD = 5;

/**
 * VISION §8.1's four-row tier table: 0 = auto-merge immediately (least review), 1 = fast
 * single-approve same-day, 2 = standard review, 3 = mandatory named-owner review that not even
 * the requesting persona or the human who dispatched it can satisfy (most review).
 */
export type RiskTier = 0 | 1 | 2 | 3;

/**
 * A single directory touched by a diff, with enough raw history for `classifyRiskTier` to apply
 * the 1.5 ADR's rules itself (rather than trusting a pre-resolved number) — `isNew` is the
 * ADR's own explicit floor: a brand-new directory never inherits track record no matter what
 * `consecutiveUnrevertedMerges` might otherwise say. For a git-detected rename, the caller is
 * expected to already have resolved `consecutiveUnrevertedMerges` from the rename's source path
 * (real git plumbing lives outside this pure function) and set `isNew: false`.
 */
export type TouchedDirectory = {
  readonly path: string;
  readonly isNew: boolean;
  readonly consecutiveUnrevertedMerges: number;
};

/**
 * Pre-classified facts about a diff — path-pattern matching (which paths count as "sensitive",
 * what the size threshold is) is deliberately left to a later enforcement-wiring chunk, not
 * this pure classifier.
 *
 * `isLogicChange` and `isEligibleNonLogicChange` are deliberately separate, not complements of
 * each other: VISION §8.1's Tier 0 gate names a specific carve-out — "docs/config/lint-only or a
 * non-major devDependency bump" — not simply "anything that isn't a logic change." A *major*
 * devDependency bump is also not a logic change (`isLogicChange: false`), but the table
 * explicitly excludes it from Tier 0, so it must also set `isEligibleNonLogicChange: false`.
 * Collapsing these into one boolean would silently let a major bump slip into auto-merge.
 */
export type DiffMeta = {
  readonly ciAllGreen: boolean;
  readonly touchesSensitivePath: boolean;
  readonly isBelowSizeThreshold: boolean;
  readonly isLogicChange: boolean;
  readonly isEligibleNonLogicChange: boolean;
  readonly hasAccompanyingTest: boolean;
  readonly crossesPackageBoundary: boolean;
  readonly touchedDirectories: readonly TouchedDirectory[];
};

/**
 * The 1.5 ADR's rule for a diff spanning multiple directories: take the minimum effective track
 * record across all of them (a brand-new directory's effective count is always 0, regardless of
 * `consecutiveUnrevertedMerges`) — track record in one directory doesn't transfer to another the
 * persona hasn't proven itself in. An empty directory list has no track record to claim.
 */
function hasTrackRecord(
  touchedDirectories: readonly TouchedDirectory[],
): boolean {
  if (touchedDirectories.length === 0) return false;

  const effectiveCounts = touchedDirectories.map((directory) =>
    directory.isNew ? 0 : directory.consecutiveUnrevertedMerges,
  );
  return Math.min(...effectiveCounts) >= TRACK_RECORD_THRESHOLD;
}

/**
 * Classifies a diff into a risk tier per VISION §8.1's table and the 1.5 ADR
 * (`docs/decisions/TRACK-RECORD-DEFINITION.md`). A sensitive path is a hard floor: it always
 * lands at Tier 3 regardless of CI status, tests, or track record — "a perfect 90-day history on
 * a payments module still doesn't buy auto-merge there" (VISION §8.1). No enforcement wiring
 * here — this only decides the tier, it doesn't act on it.
 */
export function classifyRiskTier(diffMeta: DiffMeta): RiskTier {
  if (diffMeta.touchesSensitivePath) return 3;

  if (diffMeta.crossesPackageBoundary) return 2;

  const isAutoMergeEligible =
    diffMeta.isEligibleNonLogicChange &&
    diffMeta.ciAllGreen &&
    diffMeta.isBelowSizeThreshold;
  if (isAutoMergeEligible) return 0;

  const isFastApproveEligible =
    diffMeta.isLogicChange &&
    diffMeta.hasAccompanyingTest &&
    hasTrackRecord(diffMeta.touchedDirectories);
  if (isFastApproveEligible) return 1;

  return 2;
}
