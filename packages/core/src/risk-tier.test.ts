import type { DiffMeta, TouchedDirectory } from './risk-tier.js';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { classifyRiskTier } from './risk-tier.js';

function establishedDirectory(path: string): TouchedDirectory {
  return { path, isNew: false, consecutiveUnrevertedMerges: 10 };
}

function baseDiffMeta(): DiffMeta {
  return {
    ciAllGreen: true,
    touchesSensitivePath: false,
    isBelowSizeThreshold: true,
    isLogicChange: true,
    isEligibleNonLogicChange: false,
    hasAccompanyingTest: true,
    crossesPackageBoundary: false,
    touchedDirectories: [
      establishedDirectory('packages/core/src/ticket-lifecycle'),
    ],
  };
}

describe('classifyRiskTier', () => {
  it('auto-merges a docs/config/lint-only or non-major devDependency-bump change with green CI below the size threshold (Tier 0)', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      isLogicChange: false,
      isEligibleNonLogicChange: true,
    });
    expect(result).toBe(0);
  });

  it('does not auto-merge an eligible non-logic change when CI is red', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      isLogicChange: false,
      isEligibleNonLogicChange: true,
      ciAllGreen: false,
    });
    expect(result).toBe(2);
  });

  it('does not auto-merge an eligible non-logic change above the size threshold', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      isLogicChange: false,
      isEligibleNonLogicChange: true,
      isBelowSizeThreshold: false,
    });
    expect(result).toBe(2);
  });

  it('does not auto-merge a major devDependency bump — not a logic change, but not the Tier 0 carve-out either', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      isLogicChange: false,
      isEligibleNonLogicChange: false,
    });
    expect(result).toBe(2);
  });

  it('fast-approves a tested logic change in a directory with track record (Tier 1)', () => {
    const result = classifyRiskTier(baseDiffMeta());
    expect(result).toBe(1);
  });

  it('requires standard review for a logic change with no accompanying test', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      hasAccompanyingTest: false,
    });
    expect(result).toBe(2);
  });

  it('requires standard review for a tested change with no track record', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      touchedDirectories: [
        {
          path: 'packages/core/src/new-thing',
          isNew: false,
          consecutiveUnrevertedMerges: 4,
        },
      ],
    });
    expect(result).toBe(2);
  });

  it('requires standard review for any diff crossing a package boundary, even with tests and track record', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      crossesPackageBoundary: true,
    });
    expect(result).toBe(2);
  });

  it('never transfers track record to a brand-new directory, regardless of its merge count', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      touchedDirectories: [
        {
          path: 'packages/core/src/brand-new',
          isNew: true,
          consecutiveUnrevertedMerges: 999,
        },
      ],
    });
    expect(result).toBe(2);
  });

  it('takes the minimum track record across multiple touched directories', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      touchedDirectories: [
        establishedDirectory('packages/core/src/ticket-lifecycle'),
        {
          path: 'packages/core/src/status-claim',
          isNew: false,
          consecutiveUnrevertedMerges: 2,
        },
      ],
    });
    expect(result).toBe(2);
  });

  it('mandates named-owner review for a sensitive path, regardless of CI, tests, or track record', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      touchesSensitivePath: true,
    });
    expect(result).toBe(3);
  });

  it('a sensitive path overrides even a perfect track record — the hard floor VISION §8.1 describes', () => {
    const result = classifyRiskTier({
      ciAllGreen: true,
      touchesSensitivePath: true,
      isBelowSizeThreshold: true,
      isLogicChange: true,
      isEligibleNonLogicChange: false,
      hasAccompanyingTest: true,
      crossesPackageBoundary: false,
      touchedDirectories: [
        establishedDirectory('packages/core/src/ticket-lifecycle'),
      ],
    });
    expect(result).toBe(3);
  });

  it('requires standard review when no directories are touched', () => {
    const result = classifyRiskTier({
      ...baseDiffMeta(),
      touchedDirectories: [],
    });
    expect(result).toBe(2);
  });

  it('property: touching a sensitive path always yields Tier 3, regardless of every other field', () => {
    const diffMetaArbitrary = fc.record({
      ciAllGreen: fc.boolean(),
      touchesSensitivePath: fc.constant(true),
      isBelowSizeThreshold: fc.boolean(),
      isLogicChange: fc.boolean(),
      isEligibleNonLogicChange: fc.boolean(),
      hasAccompanyingTest: fc.boolean(),
      crossesPackageBoundary: fc.boolean(),
      touchedDirectories: fc.array(
        fc.record({
          path: fc.string({ minLength: 1 }),
          isNew: fc.boolean(),
          consecutiveUnrevertedMerges: fc.nat(),
        }),
      ),
    });

    fc.assert(
      fc.property(diffMetaArbitrary, (diffMeta) => {
        expect(classifyRiskTier(diffMeta)).toBe(3);
      }),
    );
  });

  it('property: crossing a package boundary without touching a sensitive path always yields Tier 2', () => {
    const diffMetaArbitrary = fc.record({
      ciAllGreen: fc.boolean(),
      touchesSensitivePath: fc.constant(false),
      isBelowSizeThreshold: fc.boolean(),
      isLogicChange: fc.boolean(),
      isEligibleNonLogicChange: fc.boolean(),
      hasAccompanyingTest: fc.boolean(),
      crossesPackageBoundary: fc.constant(true),
      touchedDirectories: fc.array(
        fc.record({
          path: fc.string({ minLength: 1 }),
          isNew: fc.boolean(),
          consecutiveUnrevertedMerges: fc.nat(),
        }),
      ),
    });

    fc.assert(
      fc.property(diffMetaArbitrary, (diffMeta) => {
        expect(classifyRiskTier(diffMeta)).toBe(2);
      }),
    );
  });

  it('property: a tested, non-boundary-crossing logic change reaches Tier 1 exactly when every touched directory has an established (non-new) track record at or above the threshold', () => {
    const directoryArbitrary = fc.record({
      path: fc.string({ minLength: 1 }),
      isNew: fc.boolean(),
      consecutiveUnrevertedMerges: fc.nat({ max: 20 }),
    });

    fc.assert(
      fc.property(
        fc.array(directoryArbitrary, { minLength: 1 }),
        (touchedDirectories) => {
          const result = classifyRiskTier({
            ciAllGreen: true,
            touchesSensitivePath: false,
            isBelowSizeThreshold: true,
            isLogicChange: true,
            isEligibleNonLogicChange: false,
            hasAccompanyingTest: true,
            crossesPackageBoundary: false,
            touchedDirectories,
          });

          const expectTier1 = touchedDirectories.every(
            (directory) =>
              !directory.isNew && directory.consecutiveUnrevertedMerges >= 5,
          );
          expect(result).toBe(expectTier1 ? 1 : 2);
        },
      ),
    );
  });

  it('property: a non-logic change never reaches Tier 1, regardless of tests or track record', () => {
    const diffMetaArbitrary = fc.record({
      ciAllGreen: fc.boolean(),
      touchesSensitivePath: fc.constant(false),
      isBelowSizeThreshold: fc.boolean(),
      isLogicChange: fc.constant(false),
      isEligibleNonLogicChange: fc.boolean(),
      hasAccompanyingTest: fc.boolean(),
      crossesPackageBoundary: fc.constant(false),
      touchedDirectories: fc.array(
        fc.record({
          path: fc.string({ minLength: 1 }),
          isNew: fc.boolean(),
          consecutiveUnrevertedMerges: fc.nat(),
        }),
      ),
    });

    fc.assert(
      fc.property(diffMetaArbitrary, (diffMeta) => {
        expect(classifyRiskTier(diffMeta)).not.toBe(1);
      }),
    );
  });

  it('property: a change ineligible for the Tier 0 carve-out never auto-merges, regardless of CI or size', () => {
    const diffMetaArbitrary = fc.record({
      ciAllGreen: fc.boolean(),
      touchesSensitivePath: fc.constant(false),
      isBelowSizeThreshold: fc.boolean(),
      isLogicChange: fc.boolean(),
      isEligibleNonLogicChange: fc.constant(false),
      hasAccompanyingTest: fc.boolean(),
      crossesPackageBoundary: fc.constant(false),
      touchedDirectories: fc.array(
        fc.record({
          path: fc.string({ minLength: 1 }),
          isNew: fc.boolean(),
          consecutiveUnrevertedMerges: fc.nat(),
        }),
      ),
    });

    fc.assert(
      fc.property(diffMetaArbitrary, (diffMeta) => {
        expect(classifyRiskTier(diffMeta)).not.toBe(0);
      }),
    );
  });
});
