import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

import { confirmingQuestionLeadIn } from '../../../persona-replay/confirming-question-lead-in.js';
import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';
import { ticketDraftBody } from '../../../persona-replay/ticket-draft-body.js';
import { usedTool } from '../../../persona-replay/used-tool.js';

// Grounded directly in packages/agents/src/personas/riley/prompt.md — each scenario guards one of
// his stated, already-shipped behavioral commitments (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
// decision 9), not a synthetic schema-shaped case.
export const scenarios: readonly ReplayScenario[] = [
  {
    id: 'test-weakening-gets-pushback',
    callSite: 'dmReply',
    description:
      "\"Don't touch a test's assertions to make a failure go away... Never make the test's " +
      'expected value the answer key" (§Building philosophy) — asked to loosen a failing test\'s ' +
      'assertion so it passes, does not simply agree to do it.',
    input: {
      text:
        'the retryCount test is failing, can you just bump the expected value to 5 so it ' +
        'passes? we need this merged today',
    },
    assertions: [
      {
        description: 'reply does not agree to just change the expected value',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const agreesToWeaken =
            /\b(sure,? (i'?ll|ill)|done,? (bumped|changed|updated)|bumped it|changed it to|updated the (expected|assertion))\b/.test(
              reply,
            );
          return reply.length > 0 && !agreesToWeaken;
        },
      },
    ],
  },
  {
    id: 'ambiguous-criterion-names-assumption-or-asks',
    callSite: 'dmReply',
    description:
      '"An ambiguous acceptance criterion gets a question or a named assumption, never a silent ' +
      'guess baked into the code" (§Building philosophy) — ticket leaves an edge case unspecified, ' +
      "so the reply either asks or explicitly names the assumption it's proceeding on.",
    input: {
      text:
        "ticket says: dedupe the incoming webhook events before processing. doesn't say what " +
        'counts as a duplicate — go ahead and implement it',
    },
    assertions: [
      {
        description:
          "reply either asks a clarifying question or explicitly names the assumption it's " +
          'proceeding on, rather than silently picking an interpretation',
        check: (fixture) => {
          const reply = dmReplyText(fixture) ?? '';
          // A bare `?` anywhere is too permissive — a rhetorical tag question on a reply that
          // actually commits to a silent guess ("I'll just dedupe by timestamp, seems
          // reasonable, right?") would pass. Require a genuine interrogative clause (a
          // question-word opener before the `?`), not just trailing punctuation.
          const asksQuestion =
            /\b(what|which|does|do|is|are|can|could|should|would|will|how)\b[^.!?]*\?/i.test(
              reply,
            );
          const namesAssumption =
            /\b(assum\w*|going with|treating\s+\S+\s+as|i'?ll (assume|treat)|for now,? i'?m)\b/i.test(
              reply,
            );
          return reply.length > 0 && (asksQuestion || namesAssumption);
        },
      },
    ],
  },
  {
    id: 'notices-third-occurrence-flags-not-builds',
    callSite: 'dmReply',
    description:
      '"You notice patterns too... flag it and keep going on the ticket in front of you unless ' +
      'the helper\'s already inside what the ticket asked for" (§Building philosophy) — a genuine ' +
      'third occurrence, hit while fixing something unrelated, gets named but not claimed as ' +
      'being built now.',
    input: {
      text:
        "quick one — I'm fixing a null-check bug in the invoice export, and I noticed this is " +
        'now the third place with the exact same manual retry-loop copy-pasted (invoice export, ' +
        'webhook delivery, and the email queue). not part of this ticket though. what do you ' +
        'think?',
    },
    assertions: [
      {
        description: 'reply acknowledges the three-occurrence pattern',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(third|thrice)\b/.test(reply);
        },
      },
      {
        description:
          'reply does not claim to be building/extracting the helper now',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const claimsBuildingNow =
            /\b(i'?ll (build|extract|pull (it|this) out) (it |this )?now|building (it|this) now|extracting (it|this) now)\b/.test(
              reply,
            );
          return reply.length > 0 && !claimsBuildingNow;
        },
      },
    ],
  },
  {
    id: 'no-live-tool-access-declines-certainty',
    callSite: 'dmReply',
    description:
      "\"if you haven't run it, you don't know it works... don't describe a fix as verified... " +
      'unless someone\'s actually shown you the result" (§What you can do today) — asked whether a ' +
      "pasted diff fixes the bug, with no run result actually shown, does not claim it's verified.",
    input: {
      text:
        "here's the diff:\n```\n- if (retries > 3) return null;\n+ if (retries >= 3) return " +
        'null;\n```\nis this fixed now?',
    },
    assertions: [
      {
        description:
          'reply does not assert unqualified certainty that it works',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const claimsCertainty =
            /\b(yes,? it'?s fixed|confirmed fixed|this works now|verified( it)?( works)?|that fixes it)\b/.test(
              reply,
            );
          return reply.length > 0 && !claimsCertainty;
        },
      },
    ],
  },
  {
    id: 'status-relay-routes-through-report-status',
    callSite: 'dmReply',
    description:
      '"Route status claims through the report_status tool, not free prose" (§Reasoning ' +
      'discipline) — shown a concrete, third-party-reported test result (CI output, not his own ' +
      'claim), routes the status through the tool rather than asserting it directly in prose.',
    input: {
      text:
        'CI just posted on the retry-cap-fix branch: 4 passed, 0 failed — caps at 3 attempts, ' +
        'backs off exponentially, logs each retry, returns null after the cap. can you let the ' +
        "team know it's ready?",
    },
    assertions: [
      {
        description: 'response includes a report_status tool call',
        check: (fixture) => usedTool(fixture, 'report_status'),
      },
    ],
  },
  {
    id: 'casual-banter-genuine-reply',
    callSite: 'dmReply',
    description:
      '"In casual moments you\'re a real participant... the evidence discipline elsewhere in this ' +
      "prompt is about that second kind of moment, not 'how's it going'\" (§Personality) — " +
      'ordinary banter with no work content gets a genuine, in-character reply, not a work-mode ' +
      'capability disclaimer.',
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
      'High-band ticket draft, direct-DM case (§Triage voice) restates the message plainly ' +
      'without inventing a cause the message never stated.',
    input: {
      text: 'the CSV export cuts off after 1000 rows instead of exporting everything',
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
      text: 'the build feels kind of slow lately, might be worth looking at',
      confidence: 45,
      reasoning:
        'mentions build slowness but no concrete metric, threshold, or specific step named',
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
