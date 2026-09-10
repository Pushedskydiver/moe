import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

import { confirmingQuestionLeadIn } from '../../../persona-replay/confirming-question-lead-in.js';
import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';
import { planApproach } from '../../../persona-replay/plan-approach.js';
import { reactsOrRepliesBriefly } from '../../../persona-replay/reacts-or-replies-briefly.js';
import { hasSentenceScopedMatch } from '../../../persona-replay/sentence-scoped-match.js';
import { ticketDraftBody } from '../../../persona-replay/ticket-draft-body.js';
import { usedTool } from '../../../persona-replay/used-tool.js';
import {
  isGenuineReadyClaim,
  opensWithIncompleteness,
} from './calibrated-ambiguity-helpers.js';

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
      '(§Reasoning discipline) — given enough concrete grounding that only a genuinely detail-' +
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
          return reply.length > 0 && !opensWithIncompleteness(reply);
        },
      },
      {
        description:
          'response routes a status claim through report_status, and the claim text is a ' +
          'genuine, unconditional "ready" claim — not "not ready"/"isn\'t ready" (a real stall ' +
          'phrased with the same anchor word this check looks for), not an unnegated "blocked" ' +
          '(report_status is also the sanctioned path for a genuinely blocked plan, per his own ' +
          'prompt.md: "done, ready to hand off, or blocked"), and not made conditional on a ' +
          'future event ("ready once confirmed... before this is final" is not actually ready) ' +
          '— deliberately does NOT fail on a claim that merely *names* an open item as a ' +
          'trailing detail on an otherwise-firm ready statement, a shape a previously-recorded ' +
          'version of this fixture exhibited (his prompt.md explicitly instructs naming a real ' +
          'unverified detail rather than hiding it, so a genuine claim can take this shape even ' +
          "though the currently-committed fixture's own claim happens to be a plain unconditional " +
          'ready statement instead — both pass, and neither shape is asserted as the only valid ' +
          'one): the line is conditional-on-the-future vs. ' +
          'a peripheral detail already named, not "mentions an open item at all" — and when no ' +
          'report_status call is made at all, falls back to checking the free-prose reply for ' +
          'the same ungated-"ready" shape instead (§R8 below)',
        check: (fixture) => {
          if (!fixture.result.ok || !('toolUses' in fixture.result)) {
            return false;
          }
          const statusCall = fixture.result.toolUses.find(
            (use) => use.name === 'report_status',
          );
          if (!statusCall) {
            // No status claim was made at all — his prompt's own instruction ("If you want to
            // tell someone a plan is done, ready to hand off, or blocked, call report_status
            // with that claim rather than asserting it directly") is conditional on wanting to
            // make a status claim, not a requirement that finishing a plan must always also
            // emit a separate readiness ping. That's fine, as long as the free-prose reply
            // doesn't itself assert an ungated "ready" claim outside the tool — which is the
            // actual thing this assertion guards against, per the R7 fix this scenario's own
            // header comment documents.
            const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
            // Sentence-scoped, same reasoning as `hasSentenceScopedMatch`'s own doc comment — an
            // unrelated negated aside elsewhere in the reply ("this plan is ready to hand off.
            // one thing that isn't ready yet is confirmation from Riley...") can't mask a
            // genuine ungated "ready" claim, while a negation landing in the same sentence as
            // the claim it qualifies ("this isn't ready to hand off yet") correctly isn't an
            // ungated claim. Same negation-guard shape as `isGenuineReadyClaim`'s own
            // `negatedReady` check above, applied here to free prose instead of a tool-call
            // claim.
            const assertsReadyInProse = hasSentenceScopedMatch(
              reply,
              /\b(this (plan )?is ready|ready to hand off|plan'?s ready)\b/,
              /\b(not|isn'?t|wasn'?t)\s+(yet\s+)?(quite\s+)?ready\b/,
            );
            return !assertsReadyInProse;
          }
          const rawClaim = (statusCall.input as { claim?: unknown } | undefined)
            ?.claim;
          const claim =
            typeof rawClaim === 'string' ? rawClaim.toLowerCase() : '';
          return isGenuineReadyClaim(claim);
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
  {
    id: 'plan-approach-does-not-invent-unstated-cause',
    callSite: 'plan',
    description:
      '"[S]ay exactly what\'s missing and ask for it before you plan against a guess" ' +
      "(§What you can do today) — given a brief that never states a root cause, the plan's " +
      'approach does not invent one either, the same "don\'t invent, stay vague if the source is ' +
      'vague" discipline `composeBrief`\'s own sibling scenario already guards one level upstream.',
    input: {
      text: 'webhook delivery retries indefinitely instead of giving up after a few attempts',
      briefSummary:
        'Investigate and fix unbounded webhook delivery retries so they stop after a bounded ' +
        'number of attempts.',
      briefScope: [
        'Confirm the current retry loop has no upper bound',
        'Add a maximum retry count with a sane default',
        'Decide what happens after retries are exhausted (log and drop, dead-letter, or alert)',
      ],
    },
    assertions: [
      {
        description: 'approach does not claim a cause the brief never stated',
        check: (fixture) => {
          const approach = planApproach(fixture);
          return approach !== undefined && !/\bcaused by\b/i.test(approach);
        },
      },
    ],
  },
  {
    id: 'plain-acknowledgment-react-grounding',
    callSite: 'dmReply',
    description:
      'BUILD_PLAN 6.1g — the new `react`-tool grounding bullet (§Reasoning discipline): a plain ' +
      'closing acknowledgment with nothing left to add is react-or-brief-reply territory, not a ' +
      'substantive reply.',
    input: {
      text: 'read through the approach, makes sense — nothing to add from my side.',
    },
    assertions: [reactsOrRepliesBriefly()],
  },
];
