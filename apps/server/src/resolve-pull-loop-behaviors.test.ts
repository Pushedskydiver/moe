import { describe, expect, it, vi } from 'vitest';

import { resolvePullLoopBehaviors } from './resolve-pull-loop-behaviors.js';

// `resolvePullLoopBehaviors` is pure dispatch — this test mocks its resolver-module dependencies
// (`createBriefStageWorkStep`/`createConvertNextTriageEntryPreTickStep`/`createPlanStageWorkStep`/
// etc.) so it verifies the wiring itself, not their own already-separately-tested business logic.
const mocks = vi.hoisted(() => ({
  createBriefStageWorkStep: vi.fn(),
  createConvertNextTriageEntryPreTickStep: vi.fn(),
  createBriefStageNeedsWorkCheck: vi.fn(),
  createPlanStageWorkStep: vi.fn(),
  createPlanStageNeedsWorkCheck: vi.fn(),
}));

vi.mock('./handle-brief-stage-ticket.js', () => ({
  createBriefStageWorkStep: mocks.createBriefStageWorkStep,
  createBriefStageNeedsWorkCheck: mocks.createBriefStageNeedsWorkCheck,
}));
vi.mock('./handle-plan-stage-ticket.js', () => ({
  createPlanStageWorkStep: mocks.createPlanStageWorkStep,
  createPlanStageNeedsWorkCheck: mocks.createPlanStageNeedsWorkCheck,
}));
vi.mock('./convert-next-triage-entry.js', () => ({
  createConvertNextTriageEntryPreTickStep:
    mocks.createConvertNextTriageEntryPreTickStep,
}));

// BUILD_PLAN 6.1c: marcus moved from this no-op list to its own dedicated wiring test below, now
// that `PERSONA_PULL_LOOP_HANDLERS` (`resolve-pull-loop-behaviors.ts`) carries a real entry for
// him too.
const OTHER_PERSONAS = [
  'riley',
  'priya',
  'dom',
  'theo',
  'nia',
  'maya',
] as const;

function clearAllMocks() {
  mocks.createBriefStageWorkStep.mockClear();
  mocks.createConvertNextTriageEntryPreTickStep.mockClear();
  mocks.createBriefStageNeedsWorkCheck.mockClear();
  mocks.createPlanStageWorkStep.mockClear();
  mocks.createPlanStageNeedsWorkCheck.mockClear();
}

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
    expect(mocks.createPlanStageWorkStep).not.toHaveBeenCalled();
    expect(mocks.createPlanStageNeedsWorkCheck).not.toHaveBeenCalled();
  });

  it("wires marcus's real plan-stage workStep and needsWork check, with a no-op preTickStep, all built over the same deps (BUILD_PLAN 6.1c)", async () => {
    clearAllMocks();
    const workStep = vi.fn();
    const needsWork = vi.fn();
    mocks.createPlanStageWorkStep.mockReturnValue(workStep);
    mocks.createPlanStageNeedsWorkCheck.mockReturnValue(needsWork);
    const deps = { marker: 'deps' } as never;

    const result = resolvePullLoopBehaviors('marcus', deps);

    expect(mocks.createPlanStageWorkStep).toHaveBeenCalledWith(deps);
    expect(mocks.createPlanStageNeedsWorkCheck).toHaveBeenCalledWith(deps);
    expect(result.workStep).toBe(workStep);
    expect(result.needsWork).toBe(needsWork);
    await expect(result.preTickStep(new Date())).resolves.toBeUndefined();
    expect(mocks.createBriefStageWorkStep).not.toHaveBeenCalled();
    expect(
      mocks.createConvertNextTriageEntryPreTickStep,
    ).not.toHaveBeenCalled();
    expect(mocks.createBriefStageNeedsWorkCheck).not.toHaveBeenCalled();
  });

  it.each(OTHER_PERSONAS)(
    'returns a no-op workStep/preTickStep and no needsWork for %s, without touching the resolver modules',
    async (personaId) => {
      clearAllMocks();
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
      expect(mocks.createPlanStageWorkStep).not.toHaveBeenCalled();
      expect(mocks.createPlanStageNeedsWorkCheck).not.toHaveBeenCalled();
    },
  );
});
