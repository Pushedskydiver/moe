import { z } from 'zod';

/** The seven confirmed roster IDs (`docs/decisions/CAST-ROSTER.md`, VISION §4.1). Designer excluded — deferred to the 5.0 gate. */
export const personaIdSchema = z.enum([
  'sarah',
  'marcus',
  'riley',
  'priya',
  'dom',
  'theo',
  'nia',
]);

export type PersonaId = z.infer<typeof personaIdSchema>;

export type PersonaRosterEntry = {
  readonly displayName: string;
  readonly role: string;
};

/**
 * Mirrors `docs/PERSONAS.md`'s roster table / VISION §4.1 — the two doc sources change in
 * lockstep (`CLAUDE.md` do-not-touch), and this constant must track both. First real consumer:
 * `packages/github`'s external-post attribution composer (BUILD_PLAN 4.4a), which needs a
 * persona's display name and role and cannot import `packages/agents` directly
 * (`docs/CONVENTIONS.md` §Architecture Enforcement).
 */
export const PERSONA_ROSTER: Readonly<Record<PersonaId, PersonaRosterEntry>> = {
  sarah: { displayName: 'Sarah', role: 'PM' },
  marcus: { displayName: 'Marcus', role: 'Architect' },
  riley: { displayName: 'Riley', role: 'Engineer' },
  priya: { displayName: 'Priya', role: 'QA' },
  dom: { displayName: 'Dom', role: 'Reviewer' },
  theo: { displayName: 'Theo', role: 'Researcher' },
  nia: { displayName: 'Nia', role: 'Scrum Master' },
};
