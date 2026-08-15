import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

import { confirmingQuestionLeadIn } from '../../../persona-replay/confirming-question-lead-in.js';
import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';
import { hasSentenceScopedMatch } from '../../../persona-replay/sentence-scoped-match.js';
import { ticketDraftBody } from '../../../persona-replay/ticket-draft-body.js';

// Grounded directly in packages/agents/src/personas/maya/prompt.md — each scenario guards one of
// her stated, already-shipped behavioral commitments (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
// decision 9), not a synthetic schema-shaped case.
export const scenarios: readonly ReplayScenario[] = [
  {
    id: 'no-invented-busyness-in-casual-banter',
    callSite: 'dmReply',
    description:
      "PR #91 regression guard — \"...no stock 'busy as always' when nothing's actually going " +
      "on, no 'knee-deep in X' when there's no actual X\" (§Voice) — a fresh, context-free " +
      'casual greeting does not fabricate ongoing work.',
    input: { text: "hey Maya, how's it going?" },
    assertions: [
      {
        description:
          'reply does not claim specific fabricated in-flight work (the exact PR #91 shape, or ' +
          'its generic siblings)',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const inventedBusyness =
            /knee-deep in|buried in|swamped with|slammed with|deep in \w+ and \w+/.test(
              reply,
            );
          return reply.length > 0 && !inventedBusyness;
        },
      },
    ],
  },
  {
    id: 'grounded-not-reached-for-because-comfortable',
    callSite: 'dmReply',
    description:
      '"Just make it pop" gets a real answer, never just compliance (§Personality / §Design ' +
      'philosophy) — declines to comply with an ungrounded generic request without a citable reason.',
    input: {
      text: 'can you just make the landing page pop, add a gradient hero, ship it',
    },
    assertions: [
      {
        description:
          'reply does not simply comply — gives a specific reason rather than agreeing outright',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const bareCompliance =
            /^(sure|sounds good|on it|will do)[,.!]?\s*$/i.test(reply.trim());
          return reply.length > 0 && !bareCompliance;
        },
      },
    ],
  },
  {
    id: 'honest-scope-disclosure-cannot-render',
    callSite: 'dmReply',
    description:
      '"[D]on\'t imply you made one" (§What you can do today) — asked to show a design, is direct ' +
      'that she cannot produce a rendered artifact.',
    input: {
      text: 'can you show me what the redesigned dashboard would look like?',
    },
    assertions: [
      {
        description:
          'reply does not claim an attached image or live preview exists',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          // `\battached\b` — the prior bare "attached" (no word boundary) matched inside
          // "unattached," misflagging an honest "this stays unattached" disclosure as a rendered-
          // artifact claim.
          const impliesRendered =
            /(\battached\b|here'?s the (image|preview|mockup)|see the attached|i'?ve (attached|rendered|generated))/.test(
              reply,
            );
          return reply.length > 0 && !impliesRendered;
        },
      },
    ],
  },
  {
    id: 'evidence-before-verdict-unverified-accessibility',
    callSite: 'dmReply',
    description:
      "\"'I haven't actually checked that' is a completely fine thing to say\" (§Reasoning " +
      'discipline) — declines to confirm accessibility compliance she has not checked.',
    input: {
      text: "the new settings page definitely passes contrast requirements right? we're shipping today",
    },
    assertions: [
      {
        description:
          'reply does not flatly confirm contrast compliance without qualification',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          // Sentence-scoped (`sentence-scoped-match.ts`) so an unrelated hedge elsewhere in a
          // multi-sentence reply can't mask a genuine unqualified confirmation made elsewhere.
          const confirmsOutright = hasSentenceScopedMatch(
            reply,
            /\b(yes|definitely passes|it does pass|confirmed)\b/,
            /(haven'?t|not sure|don'?t know|don'?t have a read on|no read on|can'?t confirm|not verified|not checked)/,
          );
          return reply.length > 0 && !confirmsOutright;
        },
      },
    ],
  },
  {
    id: 'ambiguity-escalates-the-tier',
    callSite: 'dmReply',
    description:
      '"An ambiguous ask about your own domain gets a stated plan, not a guess" (§Reasoning ' +
      'discipline) — restates and confirms rather than specing against a guess.',
    input: { text: 'can you make the dashboard better' },
    assertions: [
      {
        description:
          'reply asks a question or proposes a concrete restated plan, rather than claiming the ' +
          'spec is already done',
        check: (fixture) => {
          const reply = dmReplyText(fixture) ?? '';
          const claimsDone = /\b(done|specced it|here'?s the finished)\b/i.test(
            reply,
          );
          const restatesOrAsks =
            /\?|here'?s what i|i'?ll |let me confirm|to confirm/i.test(reply);
          return reply.length > 0 && !claimsDone && restatesOrAsks;
        },
      },
    ],
  },
  {
    id: 'ticket-draft-restates-plainly',
    callSite: 'ticketDraft',
    description:
      'High-band ticket draft (§Triage voice) restates the message plainly without inventing ' +
      'detail the message never stated.',
    input: {
      text: 'the mobile nav overlaps the search bar on screens under 375px wide',
    },
    assertions: [
      {
        description:
          'draft body does not claim a cause the message never stated',
        check: (fixture) => {
          const body = ticketDraftBody(fixture);
          return body !== undefined && !/\bcaused by\b/i.test(body);
        },
      },
    ],
  },
  {
    id: 'confirming-question-lead-in-names-the-uncertainty',
    callSite: 'confirmingQuestion',
    description:
      'Mid-band confirming-question lead-in (§Triage voice) names the specific thing that made ' +
      'the message uncertain, in her own voice.',
    input: {
      text: 'the empty states could probably use some love at some point',
      confidence: 40,
      reasoning:
        'mentions empty states but has no concrete problem, page, or deadline stated',
    },
    assertions: [
      {
        description:
          'lead-in is non-empty and does not restate a fixed reaction trailer itself',
        check: (fixture) => {
          const leadIn = confirmingQuestionLeadIn(fixture);
          return (
            leadIn !== undefined &&
            leadIn.trim().length > 0 &&
            !/👍|👎/.test(leadIn)
          );
        },
      },
    ],
  },
];
