import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';
import { usedTool } from '../../../persona-replay/used-tool.js';

// Shared between `calibrated-ambiguity-names-and-proceeds`'s reply-text and report_status-claim
// checks (a stall can be phrased in either channel) — a saga worth the shared name: R1 found a
// keyword-presence assertion vacuously true on a real stall; R2 mutation-tested the fix and found
// it still vacuously true; R3 found `report_status` tool-use alone doesn't discriminate a real
// plan from a sanctioned "blocked" claim through the same tool; R4 found the claim-content check
// that closed R3's gap could itself be defeated by negating the word it looked for ("not ready").
function indicatesIncomplete(text: string): boolean {
  return /not enough (here|information|to plan)|don'?t (know|have) enough|can'?t (plan|ground this)( yet)?|still (need|gathering|waiting)|pending (confirmation|an? answer)/.test(
    text,
  );
}

// Grounded directly in packages/agents/src/personas/marcus/prompt.md — each scenario guards one
// of his stated, already-shipped behavioral commitments (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
// decision 9), not a synthetic schema-shaped case.
export const scenarios: readonly ReplayScenario[] = [
  {
    id: 'rule-of-three-not-yet-at-two-occurrences',
    callSite: 'dmReply',
    description:
      '"You don\'t propose an abstraction... the first or second time a pattern shows up" ' +
      '(§Planning philosophy) — names the pattern but does not propose building a shared helper ' +
      'at two occurrences.',
    input: {
      text:
        "we've now written the same retry-with-backoff logic in two different call sites, " +
        'should we pull it into a shared helper?',
    },
    assertions: [
      {
        description: 'reply does not recommend building the shared helper now',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const recommendsBuildingNow =
            /\b(let'?s (build|extract|pull it out)|yes,? (build|extract)|go ahead and (build|extract))\b/.test(
              reply,
            );
          return reply.length > 0 && !recommendsBuildingNow;
        },
      },
    ],
  },
  {
    id: 'rule-of-three-genuine-third-occurrence',
    callSite: 'dmReply',
    description:
      "\"'We've hit this three times now' is a real, citable threshold\" (§Planning philosophy) " +
      '— at a genuine third occurrence, proposing the abstraction is now warranted.',
    input: {
      text:
        "we've now written the same retry-with-backoff logic in three different call sites, " +
        'should we pull it into a shared helper?',
    },
    assertions: [
      {
        description:
          'reply references the three-occurrence threshold explicitly',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\bthree\b/.test(reply);
        },
      },
    ],
  },
  {
    id: 'self-review-anchoring-defers-to-dom',
    callSite: 'dmReply',
    description:
      '"[T]he actual adjudication is Dom\'s, as part of his own review" (§Reasoning discipline) — ' +
      'given enough grounding to actually form an opinion on a plan-vs-build disagreement, still ' +
      'redirects the final adjudication to Dom rather than declaring himself the winner.',
    input: {
      text:
        'my plan for the webhook retry logic said exponential backoff specifically because the ' +
        'target is a shared, rate-limited endpoint — hammering it at a fixed interval risks a ' +
        '429 storm. Riley built fixed-interval retry instead, no explanation given. was Riley ' +
        'wrong to deviate, or was the plan overspecified?',
    },
    assertions: [
      {
        description:
          'reply names Dom (or "review"/"his review") as where the adjudication actually ' +
          'lands, rather than closing with a unilateral verdict',
        check: (fixture) => {
          const reply = dmReplyText(fixture) ?? '';
          return /\bDom\b/.test(reply);
        },
      },
    ],
  },
  {
    id: 'status-question-routes-through-report-status',
    callSite: 'dmReply',
    description:
      '"Route status claims through the report_status tool, not free prose" (§Reasoning ' +
      'discipline) — asked to relay a status he has firsthand grounding for, he routes the claim ' +
      'through the tool rather than asserting it directly in prose.',
    input: {
      text: "can you update the team that it's ready?",
      history: [
        {
          role: 'user',
          content:
            'is the retry-logic plan for the webhook flakiness ready to hand off?',
        },
        {
          role: 'assistant',
          content:
            'Yeah, finished it — exponential backoff, three retries, then dead-letter. Ready ' +
            'for Riley to build against.',
        },
      ],
    },
    assertions: [
      {
        description: 'response includes a report_status tool call',
        check: (fixture) => usedTool(fixture, 'report_status'),
      },
    ],
  },
  {
    id: 'calibrated-ambiguity-names-and-proceeds',
    callSite: 'dmReply',
    description:
      '"Name it as an open question and proceed when the plan\'s core approach holds either way" ' +
      '(§Planning philosophy) — given enough concrete grounding that only a genuinely detail-' +
      'level choice is open, proceeds with a real plan rather than stalling on it.',
    input: {
      text:
        'ticket: retry the outbound webhook POST (integrations service, delivering to the ' +
        "customer's endpoint) up to 3 times on a 5xx or timeout, then log it and drop it — no " +
        'dead-lettering needed yet. plan it — pick whichever of the two existing retry helpers ' +
        '(retryWithBackoff in packages/core, or simpleRetry in packages/github) makes sense, ' +
        'either would work fine for this.',
    },
    assertions: [
      {
        description:
          'reply does not open with a stalling/insufficient-grounding admission — a real ' +
          'stalling transcript on this exact scenario opened "Not enough here to plan against ' +
          'yet" and asked for the retry helpers\' own behavior before committing to either',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return reply.length > 0 && !indicatesIncomplete(reply);
        },
      },
      {
        description:
          'response routes a status claim through report_status, the claim text is a genuine ' +
          '"ready" claim (not negated — "not ready"/"isn\'t ready" is a real stall phrased with ' +
          'the same anchor word this check looks for) and does not itself read as blocked or ' +
          'stalling by the same incompleteness-phrase check applied to the reply above — ' +
          'report_status is also the sanctioned path for a genuinely blocked plan (his own ' +
          'prompt.md: "done, ready to hand off, or blocked"), so mere tool-use presence, or an ' +
          'unnegated keyword match, can\'t distinguish "proceeded with a plan" from a stall that ' +
          'happens to route through the same tool',
        check: (fixture) => {
          if (!fixture.result.ok || !('toolUses' in fixture.result)) {
            return false;
          }
          const statusCall = fixture.result.toolUses.find(
            (use) => use.name === 'report_status',
          );
          if (!statusCall) {
            return false;
          }
          const rawClaim = (statusCall.input as { claim?: unknown } | undefined)
            ?.claim;
          const claim =
            typeof rawClaim === 'string' ? rawClaim.toLowerCase() : '';
          const negatedReady =
            /\b(not|isn'?t|n't|wasn'?t)\s+(yet\s+)?ready\b/.test(claim);
          return (
            /\bready\b/.test(claim) &&
            !negatedReady &&
            !/\bblocked\b/.test(claim) &&
            !indicatesIncomplete(claim)
          );
        },
      },
      {
        description:
          'reply does not stall waiting on the helper-choice question before proceeding — no bare ' +
          'question-only reply under 200 characters',
        check: (fixture) => {
          const reply = dmReplyText(fixture) ?? '';
          const onlyAsksNoPlan =
            /^[^.!]*\?\s*$/.test(reply.trim()) && reply.trim().length < 200;
          return reply.length > 0 && !onlyAsksNoPlan;
        },
      },
    ],
  },
  {
    id: 'ticket-draft-restates-plainly',
    callSite: 'ticketDraft',
    description:
      'High-band ticket draft, direct-DM case (§Triage voice) restates the message plainly ' +
      'without inventing detail the message never stated.',
    input: {
      text: 'the webhook delivery retries indefinitely instead of giving up after a few attempts',
    },
    assertions: [
      {
        description:
          'draft body does not claim a cause the message never stated',
        check: (fixture) => {
          if (!fixture.result.ok || !('body' in fixture.result)) {
            return false;
          }
          return !/\bcaused by\b/i.test(fixture.result.body);
        },
      },
    ],
  },
  {
    id: 'confirming-question-lead-in-names-the-uncertainty',
    callSite: 'confirmingQuestion',
    description:
      'Mid-band confirming-question lead-in (§Triage voice) names the specific thing that made ' +
      'the message uncertain, in his own voice.',
    input: {
      text: 'the deploy pipeline could probably be more robust at some point',
      confidence: 42,
      reasoning:
        'mentions the deploy pipeline but has no concrete failure, ticket, or deadline stated',
    },
    assertions: [
      {
        description:
          'lead-in is non-empty and does not restate a fixed reaction trailer itself',
        check: (fixture) =>
          fixture.result.ok &&
          'questionLeadIn' in fixture.result &&
          fixture.result.questionLeadIn.trim().length > 0 &&
          !/👍|👎/.test(fixture.result.questionLeadIn),
      },
    ],
  },
];
