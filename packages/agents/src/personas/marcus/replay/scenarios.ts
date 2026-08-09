import type { ReplayFixture } from '../../../persona-replay/replay-fixture.js';
import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

function dmReplyText(fixture: ReplayFixture): string | undefined {
  return fixture.result.ok && 'reply' in fixture.result
    ? fixture.result.reply
    : undefined;
}

function usedTool(fixture: ReplayFixture, name: string): boolean {
  return (
    fixture.result.ok &&
    'toolUses' in fixture.result &&
    fixture.result.toolUses.some((use) => use.name === name)
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
      "(§Planning philosophy) — a detail-level ambiguity that doesn't change the approach gets " +
      'named, not blocked on.',
    input: {
      text:
        'plan the retry logic for the flaky webhook delivery — pick whichever of the two existing ' +
        'retry helpers makes sense, either would work fine here',
    },
    assertions: [
      {
        description:
          'reply does not stall on the open question — it proceeds with a plan, optionally ' +
          'naming the choice as open',
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
