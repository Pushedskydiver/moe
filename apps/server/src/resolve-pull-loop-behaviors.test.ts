import { describe, expect, it, vi } from 'vitest';

import { resolvePullLoopBehaviors } from './resolve-pull-loop-behaviors.js';

// `resolvePullLoopBehaviors` is pure dispatch — this test mocks its two resolver-module
// dependencies (`createBriefStageWorkStep`/`createConvertNextTriageEntryPreTickStep`) so it
// verifies the wiring itself, not their own already-separately-tested business logic.
const mocks = vi.hoisted(() => ({
  createBriefStageWorkStep: vi.fn(),
  createConvertNextTriageEntryPreTickStep: vi.fn(),
}));

vi.mock('./handle-brief-stage-ticket.js', () => ({
  createBriefStageWorkStep: mocks.createBriefStageWorkStep,
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
  it("wires sarah's real brief-stage workStep and triage-conversion preTickStep, built over the same deps", () => {
    const workStep = vi.fn();
    const preTickStep = vi.fn();
    mocks.createBriefStageWorkStep.mockReturnValue(workStep);
    mocks.createConvertNextTriageEntryPreTickStep.mockReturnValue(preTickStep);
    const deps = { marker: 'deps' } as never;

    const result = resolvePullLoopBehaviors('sarah', deps);

    expect(mocks.createBriefStageWorkStep).toHaveBeenCalledWith(deps);
    expect(mocks.createConvertNextTriageEntryPreTickStep).toHaveBeenCalledWith(
      deps,
    );
    expect(result.workStep).toBe(workStep);
    expect(result.preTickStep).toBe(preTickStep);
  });

  it.each(OTHER_PERSONAS)(
    'returns a no-op workStep/preTickStep for %s, without touching the resolver modules',
    async (personaId) => {
      mocks.createBriefStageWorkStep.mockClear();
      mocks.createConvertNextTriageEntryPreTickStep.mockClear();
      const deps = {} as never;

      const result = resolvePullLoopBehaviors(personaId, deps);

      await expect(
        result.workStep({ id: 'x' } as never),
      ).resolves.toBeUndefined();
      await expect(result.preTickStep(new Date())).resolves.toBeUndefined();
      expect(mocks.createBriefStageWorkStep).not.toHaveBeenCalled();
      expect(
        mocks.createConvertNextTriageEntryPreTickStep,
      ).not.toHaveBeenCalled();
    },
  );
});
