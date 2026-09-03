import type { ConvertNextTriageEntryDeps } from './convert-next-triage-entry.js';
import type { BriefStageDeps } from './handle-brief-stage-ticket.js';
import type { PullLoopNeedsWorkCheck, PullLoopWorkStep } from './pull-loop.js';
import type { PersonaId } from '@moe/agents';

import { createConvertNextTriageEntryPreTickStep } from './convert-next-triage-entry.js';
import {
  createBriefStageNeedsWorkCheck,
  createBriefStageWorkStep,
} from './handle-brief-stage-ticket.js';

// `BriefStageDeps`'s fields plus a `triageStore` closure — the same closure-DI treatment as
// `BriefStageDeps.briefStore`/`.issueLinkStore` already get, rather than threading a raw `db`
// handle down through this resolver. Both `createBriefStageWorkStep` and
// `createConvertNextTriageEntryPreTickStep` are built once, in the same place
// (`create-sarah-pull-loop-behavior-deps.ts`), over the same `db` handle, so one value satisfies
// both call sites without exposing `db` past that construction point.
export type PullLoopBehaviorDeps = BriefStageDeps & {
  readonly triageStore: ConvertNextTriageEntryDeps['triageStore'];
};

export type PullLoopBehaviors = {
  readonly workStep: PullLoopWorkStep;
  readonly preTickStep: (now: Date) => Promise<void>;
  // BUILD_PLAN 6.1b starvation fix — mirrors `PullLoopDeps.needsWork` (`pull-loop.ts`). Optional,
  // alongside `workStep`/`preTickStep`: the non-Sarah branch below simply omits it, behaviorally
  // identical to and type-valid alongside an explicit `undefined`.
  readonly needsWork?: PullLoopNeedsWorkCheck;
};

/**
 * BUILD_PLAN 6.1b's per-persona pull-loop behavior resolver — `main.ts`'s own entry point into
 * "what does this persona's pull loop actually do." A persona-id-keyed function in its own
 * module, same precedent as `resolvePersonaModel`/`PERSONA_CLAIMABLE_STAGES`, but deliberately
 * NOT a full 8-entry table yet: only Sarah has a real handler after this chunk (Marcus's Plan
 * handler is 6.1c, not yet built) — building a full `PERSONA_WORK_STEPS` registry now would
 * repeat the same premature-table shape `PERSONA_MODEL_OVERRIDES`'s own comment explicitly
 * avoids. Revisit as a real per-persona table once 6.1c lands a second real entry.
 */
export function resolvePullLoopBehaviors(
  personaId: PersonaId,
  deps: PullLoopBehaviorDeps,
): PullLoopBehaviors {
  if (personaId === 'sarah') {
    return {
      workStep: createBriefStageWorkStep(deps),
      preTickStep: createConvertNextTriageEntryPreTickStep(deps),
      needsWork: createBriefStageNeedsWorkCheck(deps),
    };
  }
  return { workStep: async () => {}, preTickStep: async () => {} };
}
