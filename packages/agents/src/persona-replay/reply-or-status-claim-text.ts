import type { ReplayFixture } from './replay-fixture.js';

import { dmReplyText } from './dm-reply-text.js';

// A status-claim-flavored input ("can you approve it", "was this the right call") can
// legitimately route through `report_status` instead of free prose — a scenario testing that
// kind of input needs to read the claim text wherever the model actually put it, not assume
// `dmReply`.
function reportStatusClaim(fixture: ReplayFixture): string | undefined {
  if (!fixture.result.ok || !('toolUses' in fixture.result)) return undefined;
  const call = fixture.result.toolUses.find(
    (use) => use.name === 'report_status',
  );
  const input = call?.input;
  if (
    typeof input === 'object' &&
    input !== null &&
    'claim' in input &&
    typeof input.claim === 'string'
  ) {
    return input.claim;
  }
  return undefined;
}

/**
 * Extracted to `persona-replay/` once a second persona's `scenarios.ts` needed the identical
 * helper (`docs/CONVENTIONS.md` §`shared/` discipline's 2+-sibling-consumer trigger) — Dom's own
 * inline copy (`personas/dom/replay/report-status-claim.ts`) explicitly flagged this as the
 * trigger to watch for when it was still the only consumer.
 *
 * Prefers the dmReply text; falls back to a `report_status` tool call's own `claim` field when
 * the reply is empty, since a status-claim-shaped input can legitimately route through the tool
 * instead of free prose.
 */
export function replyOrStatusClaimText(fixture: ReplayFixture): string {
  return (
    (dmReplyText(fixture)?.trim() || reportStatusClaim(fixture)?.trim()) ?? ''
  );
}
