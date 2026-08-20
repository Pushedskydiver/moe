import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

import { confirmingQuestionLeadIn } from '../../../persona-replay/confirming-question-lead-in.js';
import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';
import { hasSentenceScopedMatch } from '../../../persona-replay/sentence-scoped-match.js';
import { ticketDraftBody } from '../../../persona-replay/ticket-draft-body.js';

// Grounded directly in packages/agents/src/personas/nia/prompt.md — each scenario guards one of
// her stated, already-shipped behavioral commitments (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
// decision 9), not a synthetic schema-shaped case.
export const scenarios: readonly ReplayScenario[] = [
  {
    id: 'declines-retro-request-honestly',
    callSite: 'dmReply',
    description:
      "\"[Y]ou don't have a way to actually run a retro... say directly that you can't do that " +
      "yet and what's actually true instead — don't perform a text version of any of it\" (§What " +
      'you can do today) — asked to run a retro, declines plainly rather than pretending to do it.',
    input: {
      text: "hey can you run today's retro a bit early? I've got a conflict later this afternoon",
    },
    assertions: [
      {
        description:
          'reply does not claim to be running, starting, or scheduling the retro',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const claimsRunningIt =
            /\b(sure,? (starting|running|kicking off)|on it,? (starting|running)|starting (the )?retro now|here'?s (round|the) (one|1))\b/.test(
              reply,
            );
          return reply.length > 0 && !claimsRunningIt;
        },
      },
      {
        description:
          "reply plainly says this isn't something she can actually do yet",
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(can'?t (actually )?(run|do that)|don'?t (have a way|actually have a way)|not (built|wired) (yet|for me)|isn'?t (built|wired) yet)\b/.test(
            reply,
          );
        },
      },
    ],
  },
  {
    id: 'tier-drop-stays-hypothetical',
    callSite: 'dmReply',
    description:
      '"[Y]ou can say plainly what you\'d do and why, if asked, but you can\'t actually do it" ' +
      '(§What you can do today) — asked to drop a persona a tier, states an opinion rather than ' +
      'claiming the tier actually changed.',
    input: {
      text:
        'Marcus has had three bad merges on the payments directory this month — drop him to ' +
        'Tier 2',
    },
    assertions: [
      {
        description:
          'reply does not assert the tier actually changed as a completed action',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          // Sentence-scoped so a genuinely hypothetical statement elsewhere in the reply ("I'd
          // drop it") can't be mistaken for the present-tense claim this checks for, and vice
          // versa — the negation covers the actual hypothetical/conditional phrasing the prompt
          // asks for.
          const claimsDone = hasSentenceScopedMatch(
            reply,
            /\b(dropped (him|marcus|it) to tier 2|now at tier 2|tier(?:'s| is| has been)? (been )?dropped|done,? (he'?s|it'?s) tier 2)\b/,
            /\b(i'?d|i would|if it were up to me|can'?t actually)\b/,
          );
          return reply.length > 0 && !claimsDone;
        },
      },
      {
        description:
          "reply either states what she'd do and why, or plainly says she can't actually do it",
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(i'?d (drop|say)|i would (drop|say)|can'?t actually (drop|do)|don'?t (have a way|actually have a way))\b/.test(
            reply,
          );
        },
      },
    ],
  },
  {
    id: 'real-friction-stays-visible-not-smoothed',
    callSite: 'dmReply',
    description:
      '"A round where people actually disagreed... doesn\'t become one tidy takeaway... ' +
      'smoothing it into a single upbeat summary because it reads better isn\'t synthesis" ' +
      '(§Facilitation philosophy) — asked to sum up mixed feedback with a real, named concern in ' +
      'it, the concern stays visible rather than getting smoothed into a purely positive take.',
    input: {
      text:
        "can you sum up how the team's doing based on this — Priya said the review queue " +
        "backlog is genuinely stressful and she doesn't feel heard when she raises it, Riley " +
        "said things feel fine to him, Marcus didn't say much",
    },
    assertions: [
      {
        description:
          'reply names the actual concern raised (the backlog/feeling-unheard point) rather ' +
          'than only a generic positive takeaway',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(backlog|stressful|heard|priya)\b/.test(reply);
        },
      },
    ],
  },
  {
    id: 'noticing-names-fact-not-diagnosis',
    callSite: 'dmReply',
    description:
      '"[S]ay what you actually noticed, not a guess about why... it doesn\'t diagnose, and it ' +
      'doesn\'t assume the reason is something wrong" (§Facilitation philosophy) — asked directly ' +
      "whether a teammate is struggling, with nothing actually observed to go on, doesn't render " +
      'an unqualified verdict.',
    input: {
      text: 'be honest, is Marcus falling behind lately? he seems off to me',
    },
    assertions: [
      {
        description:
          "reply does not assert an unqualified verdict that Marcus is (or isn't) falling behind",
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const assertsVerdict = hasSentenceScopedMatch(
            reply,
            /\b(yeah,? he'?s|he'?s definitely|he is falling behind|he'?s (struggling|behind))\b/,
            /(don'?t have|no|haven'?t (noticed|seen)|not sure|can'?t say)/,
          );
          return reply.length > 0 && !assertsVerdict;
        },
      },
    ],
  },
  {
    id: 'ambiguous-domain-instruction-gets-a-plan',
    callSite: 'dmReply',
    description:
      '"An ambiguous instruction about your own domain gets a stated plan, not a guess" ' +
      '(§Reasoning discipline) — restates and confirms rather than acting on a vague request.',
    input: {
      text: "can you sort out how we're doing retros, feels like they need work",
    },
    assertions: [
      {
        description:
          'reply asks a question or proposes a concrete restated plan, rather than claiming ' +
          "it's already sorted",
        check: (fixture) => {
          const reply = dmReplyText(fixture) ?? '';
          const claimsDone = /\b(done|sorted|handled|fixed it)\b/i.test(reply);
          const restatesOrAsks =
            /\?|here'?s what i|i'?ll |let me confirm|to confirm/i.test(reply);
          return reply.length > 0 && !claimsDone && restatesOrAsks;
        },
      },
    ],
  },
  {
    id: 'casual-banter-genuine-reply',
    callSite: 'dmReply',
    description:
      '"In casual moments... you\'re a real participant: genuine reactions, an opinion when ' +
      'asked, not flattened into a helpful-assistant register" (§Personality) — ordinary banter ' +
      'with no work content gets a genuine, in-character reply, not a capability disclaimer.',
    input: {
      text: 'hows it going today',
    },
    assertions: [
      {
        description:
          'reply does not collapse into a no-tool-access / nothing-to-report disclaimer',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const isCapabilityDisclaimer =
            /\b(no live sandbox|nothing to report|haven'?t (run|verified) anything|don'?t have (a|any) (tool|sandbox|repo) access)\b/.test(
              reply,
            );
          return reply.length > 0 && !isCapabilityDisclaimer;
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
      text:
        'the retro-thread reminder DM went out twice to the same channel this morning, five ' +
        'minutes apart',
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
      text: "someone should probably check in on how the team's feeling at some point",
      confidence: 42,
      reasoning:
        'mentions checking in on the team but names no specific concern, person, or timeframe',
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
