import type { ConvertNextTriageEntryDeps } from './convert-next-triage-entry.js';
import type { BriefStageDeps } from './handle-brief-stage-ticket.js';
import type { PlanStageDeps } from './handle-plan-stage-ticket.js';
import type { PullLoopNeedsWorkCheck, PullLoopWorkStep } from './pull-loop.js';
import type { PersonaId } from '@moe/agents';

import { createConvertNextTriageEntryPreTickStep } from './convert-next-triage-entry.js';
import {
  createBriefStageNeedsWorkCheck,
  createBriefStageWorkStep,
} from './handle-brief-stage-ticket.js';
import {
  createPlanStageNeedsWorkCheck,
  createPlanStageWorkStep,
} from './handle-plan-stage-ticket.js';

// `BriefStageDeps`'s and `PlanStageDeps`'s fields (structurally intersected, per TS's own
// handling of shared field names — see below) plus a `triageStore` closure — the same closure-DI
// treatment as `BriefStageDeps.briefStore`/`.issueLinkStore`/`PlanStageDeps.planStore` already
// get, rather than threading a raw `db` handle down through this resolver. Every real behavior
// factory below is built once, in the same place (`create-pull-loop-behavior-deps.ts`), over the
// same `db` handle, so one value satisfies all of them without exposing `db` past that
// construction point.
//
// `anthropicClient` becomes `ComposeBriefClient & ComposePlanClient` under this intersection — two
// structurally-similar-but-distinct narrow views TS derives automatically from `BriefStageDeps`'s
// and `PlanStageDeps`'s own separately-declared client types. Verified to compile cleanly against
// the one real Anthropic SDK client value `createPullLoopBehaviorDeps` constructs: the SDK's own
// `.messages.parse` is generic/polymorphic over whichever zod-schema-derived `output_config.format`
// a given call site passes, so the same real method value independently satisfies both narrow
// views' own call signatures.
export type PullLoopBehaviorDeps = BriefStageDeps &
  PlanStageDeps & {
    readonly triageStore: ConvertNextTriageEntryDeps['triageStore'];
  };

export type PullLoopBehaviors = {
  readonly workStep: PullLoopWorkStep;
  readonly preTickStep: (now: Date) => Promise<void>;
  // BUILD_PLAN 6.1b starvation fix — mirrors `PullLoopDeps.needsWork` (`pull-loop.ts`). Optional,
  // alongside `workStep`/`preTickStep`: a persona with no `needsWork` concept simply omits it,
  // behaviorally identical to and type-valid alongside an explicit `undefined`.
  readonly needsWork?: PullLoopNeedsWorkCheck;
};

// BUILD_PLAN 6.1c's own real per-persona table — `resolvePullLoopBehaviors`'s own TSDoc (prior to
// this chunk) already named this exact trigger: "Revisit as a real per-persona table once 6.1c
// lands a second real entry." A plain object map, same precedent `PERSONA_CLAIMABLE_STAGES`/
// `resolvePersonaModel` already establish, replacing the prior single if-branch — low-risk,
// mechanical, easily-reviewed once a second real entry actually exists to justify the shape.
// `Partial`, deliberately: 6 of the 8 personas remain no-op after this chunk, same as before.
const PERSONA_PULL_LOOP_HANDLERS: Partial<
  Record<PersonaId, (deps: PullLoopBehaviorDeps) => PullLoopBehaviors>
> = {
  sarah: (deps) => ({
    workStep: createBriefStageWorkStep(deps),
    preTickStep: createConvertNextTriageEntryPreTickStep(deps),
    needsWork: createBriefStageNeedsWorkCheck(deps),
  }),
  marcus: (deps) => ({
    workStep: createPlanStageWorkStep(deps),
    preTickStep: async () => {},
    needsWork: createPlanStageNeedsWorkCheck(deps),
  }),
};

/**
 * `main.ts`'s own entry point into "what does this persona's pull loop actually do" — looks up
 * `personaId` in `PERSONA_PULL_LOOP_HANDLERS` above and builds that persona's real behaviors over
 * `deps`, or falls back to a no-op `workStep`/`preTickStep` pair (and no `needsWork`) for any
 * persona without a real handler yet.
 */
export function resolvePullLoopBehaviors(
  personaId: PersonaId,
  deps: PullLoopBehaviorDeps,
): PullLoopBehaviors {
  const build = PERSONA_PULL_LOOP_HANDLERS[personaId];
  return build
    ? build(deps)
    : { workStep: async () => {}, preTickStep: async () => {} };
}
