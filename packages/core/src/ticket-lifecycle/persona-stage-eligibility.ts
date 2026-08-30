import type { BoardStatus } from '../board-status.js';
import type { PersonaId } from '../persona-roster.js';

/**
 * BUILD_PLAN 6.1a-i's persona→stage eligibility mapping — which board statuses a persona's own
 * pull loop may claim from (`board-status.ts`'s own doc comment, quoted verbatim: "Sarah triages,
 * Marcus plans, Riley builds (with Priya), Dom reviews (with Priya), merge" — VISION §3.3 states
 * the same lifecycle with `→` between clauses rather than commas, not a verbatim match to this
 * exact wording, though the substance is identical).
 *
 * **Priya's `[]` here is interim, not final.** VISION §3.3 and `board-status.ts`'s own doc
 * comment both describe her eventual steady-state role as joining Riley on Build and Dom on
 * Review. She claims neither yet: BUILD_PLAN 6.3d ("Priya QA pass") is explicit that her join is
 * "additive by design: the Brief→merge flow proves out without her, then she joins." Revisit this
 * entry when 6.3d lands — a shipped persona prompt has silently dropped Priya from "Riley builds"
 * once already (BUILD_PLAN 5.3d, caught only by `copilot-surrogate`), the same class of mistake
 * a stale reading of this constant could reintroduce.
 *
 * Theo (Researcher), Nia (Scrum Master), and Maya (Designer) own no board-status-claiming stage
 * in this lifecycle at all.
 */
export const PERSONA_CLAIMABLE_STAGES: Readonly<
  Record<PersonaId, readonly BoardStatus[]>
> = {
  sarah: ['Brief'],
  marcus: ['Plan'],
  riley: ['Build'],
  priya: [],
  dom: ['Review'],
  theo: [],
  nia: [],
  maya: [],
};
