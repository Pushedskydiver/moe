import type { ReplayFixture } from '../../../persona-replay/replay-fixture.js';

import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';

// A status-claim-flavored input ("can you approve it") can legitimately route through
// `report_status` instead of free prose (§Reasoning discipline) — a scenario testing that kind of
// input needs to read the claim text wherever the model actually put it, not assume `dmReply`.
// Not promoted to `persona-replay/` (`docs/CONVENTIONS.md` §`shared/` discipline's
// 2+-sibling-consumer trigger) — Dom is the only consumer so far.
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
 * Prefers the dmReply text; falls back to a `report_status` tool call's own `claim` field when
 * the reply is empty, since a status-claim-shaped input can legitimately route through the tool
 * instead of free prose.
 */
export function replyOrStatusClaimText(fixture: ReplayFixture): string {
  return (
    (dmReplyText(fixture)?.trim() || reportStatusClaim(fixture)?.trim()) ?? ''
  );
}
