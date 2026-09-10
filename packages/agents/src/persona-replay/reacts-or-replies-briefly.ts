import type { ReplayFixture } from './replay-fixture.js';

import { dmReplyText } from './dm-reply-text.js';
import { usedTool } from './used-tool.js';

/**
 * Shared BUILD_PLAN 6.1g assertion for the `plain-acknowledgment-react-grounding` scenario every
 * persona's own `scenarios.ts` carries — extracted once the check and its description turned out
 * byte-for-byte identical across all 8 (`docs/CONVENTIONS.md` §`shared/` discipline's
 * 2+-sibling-consumer trigger), not authored as a shared helper up front.
 */
export function reactsOrRepliesBriefly(): {
  readonly description: string;
  readonly check: (fixture: ReplayFixture) => boolean;
} {
  return {
    description:
      "either reacts instead of replying (with no reply text alongside it — every persona's own " +
      'grounding paragraph says "calling this replaces the reply entirely"), or replies with a ' +
      'short, non-padded acknowledgment (under 500 characters) — a long reply here would mean ' +
      'the grounding is not producing the intended nothing-more-needed behavior; an empty ' +
      'non-tool response would mean nothing was generated at all; reacting AND also writing a ' +
      "reply would violate the grounding text's own instruction. Does not require react to fire " +
      'every time — a brief text ack is also a fine outcome; manual review of the recorded ' +
      'transcript is the primary check for this scenario ' +
      '(`docs/decisions/PERSONA-REPLAY-HARNESS.md` decision 1), this assertion is a coarse ' +
      'automated backstop only. (Does not separately validate the reaction value itself — ' +
      '`react-tool.ts`s own zod schema already guarantees that.)',
    check: (fixture: ReplayFixture) => {
      const reply = dmReplyText(fixture) ?? '';
      if (usedTool(fixture, 'react')) return reply.length === 0;
      return reply.length > 0 && reply.length < 500;
    },
  };
}
