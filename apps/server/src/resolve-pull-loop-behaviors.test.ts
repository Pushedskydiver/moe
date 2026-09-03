import { describe, expect, it, vi } from 'vitest';

import { resolvePullLoopBehaviors } from './resolve-pull-loop-behaviors.js';

// `resolvePullLoopBehaviors` is pure dispatch — this test mocks its two resolver-module
// dependencies (`createBriefStageWorkStep`/`createConvertNextTriageEntryPreTickStep`) so it
// verifies the wiring itself, not their own already-separately-tested business logic.
const mocks = vi.hoisted(() => ({
  createBriefStageWorkStep: vi.fn(),
  createConvertNextTriageEntryPreTickStep: vi.fn(),
  createBriefStageNeedsWorkCheck: vi.fn(),
}));

vi.mock('./handle-brief-stage-ticket.js', () => ({
  createBriefStageWorkStep: mocks.createBriefStageWorkStep,
  createBriefStageNeedsWorkCheck: mocks.createBriefStageNeedsWorkCheck,
}));
vi.mock('./convert-next-triage-entry.js', () => ({
  createConvertNextTriageEntryPreTickStep:
    mocks.createConvertNextTriageEntryPreTickStep,
}));

const OTHER_PERSONAS = [
  'marcus',
  'riley',
  'priya',
  'dom',
  'theo',
  'nia',
  'maya',
] as const;

describe('resolvePullLoopBehaviors', () => {
  it("wires sarah's real brief-stage workStep, triage-conversion preTickStep, and needsWork check (BUILD_PLAN 6.1b starvation fix), all built over the same deps", () => {
    const workStep = vi.fn();
    const preTickStep = vi.fn();
    const needsWork = vi.fn();
    mocks.createBriefStageWorkStep.mockReturnValue(workStep);
    mocks.createConvertNextTriageEntryPreTickStep.mockReturnValue(preTickStep);
    mocks.createBriefStageNeedsWorkCheck.mockReturnValue(needsWork);
    const deps = { marker: 'deps' } as never;

    const result = resolvePullLoopBehaviors('sarah', deps);

    expect(mocks.createBriefStageWorkStep).toHaveBeenCalledWith(deps);
    expect(mocks.createConvertNextTriageEntryPreTickStep).toHaveBeenCalledWith(
      deps,
    );
    expect(mocks.createBriefStageNeedsWorkCheck).toHaveBeenCalledWith(deps);
    expect(result.workStep).toBe(workStep);
    expect(result.preTickStep).toBe(preTickStep);
    expect(result.needsWork).toBe(needsWork);
  });

  it.each(OTHER_PERSONAS)(
    'returns a no-op workStep/preTickStep and no needsWork for %s, without touching the resolver modules',
    async (personaId) => {
      mocks.createBriefStageWorkStep.mockClear();
      mocks.createConvertNextTriageEntryPreTickStep.mockClear();
      mocks.createBriefStageNeedsWorkCheck.mockClear();
      const deps = {} as never;

      const result = resolvePullLoopBehaviors(personaId, deps);

      await expect(
        result.workStep({ id: 'x' } as never),
      ).resolves.toBeUndefined();
      await expect(result.preTickStep(new Date())).resolves.toBeUndefined();
      expect(result.needsWork).toBeUndefined();
      expect(mocks.createBriefStageWorkStep).not.toHaveBeenCalled();
      expect(
        mocks.createConvertNextTriageEntryPreTickStep,
      ).not.toHaveBeenCalled();
      expect(mocks.createBriefStageNeedsWorkCheck).not.toHaveBeenCalled();
    },
  );
});
