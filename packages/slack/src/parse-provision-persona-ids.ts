import type { PersonaId } from '@moe/core';

import { personaIdSchema } from '@moe/core';

export type ParseProvisionPersonaIdsResult =
  | { readonly ok: true; readonly personaIds: readonly PersonaId[] }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-persona-id';
        readonly rawId: string;
      };
    };

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section).
function parseIds(
  rawIds: readonly string[],
  acc: readonly PersonaId[],
): ParseProvisionPersonaIdsResult {
  const [raw, ...rest] = rawIds;
  if (raw === undefined) return { ok: true, personaIds: acc };

  const parsed = personaIdSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { kind: 'invalid-persona-id', rawId: raw } };
  }
  return parseIds(rest, [...acc, parsed.data]);
}

/**
 * Which personas a provisioning run should target — DA review's own MATERIAL finding on
 * BUILD_PLAN 5.1: `apps.manifest.create` has no natural-key dedup, so blindly re-running the
 * full default list after a partial-batch failure creates duplicate real Slack apps for every
 * persona that already succeeded. `rawOverride` (a comma-separated `MOE_SLACK_PROVISION_PERSONA_IDS`
 * env value) lets Alex target only the personas still needing a real app on a retry; an
 * unset/blank override falls back to `defaultIds` (every roster member except Sarah, who already
 * has one — computed by the caller).
 */
export function parseProvisionPersonaIds(
  rawOverride: string | undefined,
  defaultIds: readonly PersonaId[],
): ParseProvisionPersonaIdsResult {
  if (rawOverride === undefined || rawOverride.trim() === '') {
    return { ok: true, personaIds: defaultIds };
  }
  return parseIds(
    rawOverride.split(',').map((id) => id.trim()),
    [],
  );
}
