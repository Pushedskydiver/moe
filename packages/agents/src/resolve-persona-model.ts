import type { PersonaId } from './persona-config.js';

// VISION §10's resolved "Sonnet-by-default" answer — same model id `generate-reply.ts` and
// `compose-ticket-draft.ts` each separately hardcoded before this chunk (BUILD_PLAN 5.3a) gave
// per-persona model selection a real config value to live in.
const DEFAULT_MODEL = 'claude-sonnet-5';

// Empty on purpose. VISION §10: "Sonnet-by-default per persona with per-persona model tuning as
// real data comes in" — no persona has real usage data yet to tune against. Riley's future
// heavyweight coding work (BUILD_PLAN 6.2) is already flagged as wanting Opus-tier, but assigning
// that override is 6.2's own decision to make once it's actually building that call site, not
// this chunk's to anticipate speculatively.
const PERSONA_MODEL_OVERRIDES: Partial<Record<PersonaId, string>> = {};

/**
 * The per-persona model-selection lookup BUILD_PLAN 5.3a's own shared prompt-template
 * requirements call for — a fallback chain (override if configured, else the shared default),
 * hence `resolve*` rather than `evaluate*` (`docs/CONVENTIONS.md`'s verb vocabulary). Real call
 * sites (`generate-and-post-reply.ts` directly; `handle-ambient-channel-message.ts` and
 * `reaction-outcome-actions.ts` indirectly, via their shared
 * `compose-ticket-draft-and-record-usage.ts`; `compose-and-post-confirming-question.ts`'s own
 * `composeLeadInUnlessCapped`, BUILD_PLAN 5.3a-ii) pass this into
 * `generateReply`/`composeTicketDraft`/`composeConfirmingQuestionLeadIn`'s own optional `model`
 * param, the same "caller resolves a persona-specific value, the primitive defaults if omitted"
 * shape those functions already use for `system`.
 */
export function resolvePersonaModel(personaId: PersonaId): string {
  return PERSONA_MODEL_OVERRIDES[personaId] ?? DEFAULT_MODEL;
}
