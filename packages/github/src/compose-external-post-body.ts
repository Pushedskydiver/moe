import type { PersonaId } from '@moe/core';

import { PERSONA_ROSTER } from '@moe/core';

// Alex's own GitHub handle — the VISION §6.7 accountability-layer escape-hatch. Confirmed via
// AskUserQuestion over a generic team-contact line or an email: a direct, clickable, notifying
// @-mention on the same platform the external reader is already on (BUILD_PLAN 4.4a).
const ALEX_GITHUB_HANDLE = '@Pushedskydiver';

export type ComposeExternalPostBodyParams = {
  readonly personaId: PersonaId;
  readonly body: string;
};

/**
 * VISION §6.7's role-layer (persona attribution in the message body) and accountability-layer
 * (a footer escape-hatch back to Alex) for every externally-visible GitHub artifact moe writes —
 * issues now (BUILD_PLAN 4.4b), PRs and review comments at Stage 6 (chunks 6.3a/6.3b). The
 * platform-layer bot identity is the single shared GitHub App already built at chunk 4.1
 * (confirmed via AskUserQuestion: no per-persona GitHub identity work for this chunk) — this
 * function only adds the other two layers, both as deterministic boilerplate rather than
 * LLM-composed text, since no persona has an authored voice yet (chunk 5.3, do-not-touch).
 */
export function composeExternalPostBody(
  params: ComposeExternalPostBodyParams,
): string {
  const persona = PERSONA_ROSTER[params.personaId];

  return [
    params.body,
    '',
    '---',
    `🤖 *${persona.displayName} (${persona.role})* — Moe's AI teammate system. This content is AI-generated.`,
    `Questions or concerns? ${ALEX_GITHUB_HANDLE} can help.`,
  ].join('\n');
}
