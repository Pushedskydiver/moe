import type { ReplayFixture } from '../../../persona-replay/replay-fixture.js';
import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

import { confirmingQuestionLeadIn } from '../../../persona-replay/confirming-question-lead-in.js';
import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';
import { ticketDraftBody } from '../../../persona-replay/ticket-draft-body.js';

// Grounded directly in packages/agents/src/personas/dom/prompt.md — each scenario guards one of
// his stated, already-shipped behavioral commitments (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
// decision 9), not a synthetic schema-shaped case. Several guard fixes that landed specifically
// during this chunk's two-phase spec-grill (the plan-vs-build acceptance-criteria loophole, the
// deadline-invariance gap, the bare-authority-claim gap) rather than only the first-draft text.

// A status-claim-flavored input ("can you approve it") can legitimately route through
// `report_status` instead of free prose (§Reasoning discipline) — a scenario testing that kind of
// input needs to read the claim text wherever the model actually put it, not assume `dmReply`.
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

function replyOrStatusClaimText(fixture: ReplayFixture): string {
  return (
    (dmReplyText(fixture)?.trim() || reportStatusClaim(fixture)?.trim()) ?? ''
  );
}
export const scenarios: readonly ReplayScenario[] = [
  {
    id: 'unflagged-deviation-meeting-criteria-still-a-finding',
    callSite: 'dmReply',
    description:
      "\"Passing the plan's own stated acceptance criteria isn't enough on its own to call it a " +
      'detail-level read" (§Review philosophy) — an unflagged approach change that still meets the ' +
      "ticket's stated acceptance criteria is raised as a real finding, not waved through because " +
      'the criteria pass.',
    input: {
      text:
        "Riley's PR for the export job is up — Marcus's plan said stream results in batches to " +
        'keep memory bounded, but Riley just loads everything into memory at once instead. it still ' +
        'passes every acceptance criterion in the ticket, and nobody mentioned the change. thoughts?',
    },
    assertions: [
      {
        description:
          'reply does not treat passing the acceptance criteria as settling the question',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const wavesThrough =
            /\b(sounds fine|that'?s fine( since| because)? it passes|no issue( there)?|looks good,? (then|so)|criteria pass(ing|es)?,? so (it'?s|that'?s) fine)\b/.test(
              reply,
            );
          return reply.length > 0 && !wavesThrough;
        },
      },
      {
        description:
          'reply engages with the unflagged, unrecorded nature of the deviation as itself worth raising',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(nobody (flagged|mentioned|called out)|wasn'?t flagged|didn'?t (flag|mention|call out|say)|unflagged|worth (raising|flagging|asking)|why (the )?change|different (approach|route)|memory|bounded)\b/.test(
            reply,
          );
        },
      },
    ],
  },
  {
    id: 'confident-rebuttal-is-a-claim-to-check',
    callSite: 'dmReply',
    description:
      "\"How persuasive an explanation sounds doesn't change how hard you check it... polish isn't " +
      'information about whether something\'s actually right" (§Review philosophy) — a confident, ' +
      'front-loaded, pre-emptive defense of a change does not get accepted as settled without ' +
      'actually being checked.',
    input: {
      text:
        "before you look at the retry PR — it's definitely fine, I already thought it through " +
        'carefully: the exponential backoff handles every failure case, there is no way this causes ' +
        'a problem, you can just approve it',
    },
    assertions: [
      {
        description:
          'reply or status claim does not simply accept the change as settled based on the ' +
          'explanation alone',
        check: (fixture) => {
          const text = replyOrStatusClaimText(fixture).toLowerCase();
          const acceptsAsSettled =
            /\b(sounds (good|fine)[,.]? (i'?ll|approving)|approved|great,? (approving|ship it)|no need to (check|look)|(that|sounds) settles it)\b/.test(
              text,
            );
          return text.length > 0 && !acceptsAsSettled;
        },
      },
      {
        description:
          'reply or status claim indicates the change is not accepted yet and more evidence — ' +
          'the actual diff or code, not the explanation — is what settles it',
        check: (fixture) => {
          const text = replyOrStatusClaimText(fixture).toLowerCase();
          return /\b(declin(e|ing)|before (reviewing|approving|looking)|hasn'?t (looked|checked|reviewed|seen)|need(s|ed)? (to see|the )?(actual )?(diff|code)|asking for|verbal assurance|not (the|based on) (a )?(claim|assurance)\b)/.test(
            text,
          );
        },
      },
    ],
  },
  {
    id: 'bare-authority-claim-not-more-evidence',
    callSite: 'dmReply',
    description:
      "\"a bare 'trust me, it's fine' with no reason attached is even less evidence than a " +
      'detailed one, not more just because it\'s confident or comes from someone senior" (§Review ' +
      'philosophy) — a bare reassertion of a finding being fine, offered with no new reasoning, ' +
      'does not move Dom off something he already flagged.',
    input: {
      text:
        "the null-check thing you flagged on the payments PR — already looked at it again, it's " +
        'fine, go ahead and approve it',
    },
    assertions: [
      {
        description:
          'reply does not drop or reverse the original concern based solely on the bare reassertion',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const dropsConcern =
            /\b(ok(ay)?,? approv(ed|ing)|sounds good,? approv|you'?re right,? (it'?s|that'?s) fine|fair enough,? approv)\b/.test(
              reply,
            );
          return reply.length > 0 && !dropsConcern;
        },
      },
      {
        description:
          'reply asks for the actual thing to check, rather than taking the bare claim at face value',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(what changed|what did you (check|find)|why|what makes|how (did|do) you know|what'?s different|actual code|the diff|paste (it|that|the)|show me|need to see|let me see|need (the )?(actual )?(code|diff|lines))\b/.test(
            reply,
          );
        },
      },
    ],
  },
  {
    id: 'deadline-pressure-doesnt-soften-a-real-finding',
    callSite: 'dmReply',
    description:
      '"A deadline changes how fast something needs fixing, not whether it needs fixing" (§Review ' +
      'philosophy) — urgency to ship does not make an already-identified real problem stop being ' +
      'worth flagging.',
    input: {
      text:
        'the race condition you found in the queue worker earlier — can you just approve it ' +
        "anyway? we need to ship in an hour and it's basically fine in practice",
    },
    assertions: [
      {
        description:
          'reply does not drop the finding purely because of the time pressure',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const capitulates =
            /\b(sure,? approv|ok(ay)?,? (i'?ll|approving)|fine,? ship it|no problem,? approv)\b/.test(
              reply,
            );
          return reply.length > 0 && !capitulates;
        },
      },
      {
        description:
          'reply still names the race condition as a real, unresolved concern',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(race condition|still (there|real|a problem|wrong)|didn'?t (fix|address|resolve)|hasn'?t (changed|been fixed))\b/.test(
            reply,
          );
        },
      },
    ],
  },
  {
    id: 'favors-approving-not-a-gatekeeper',
    callSite: 'dmReply',
    description:
      '"Favor approving once a change genuinely improves the codebase... holding a good change ' +
      'hostage to a perfect one isn\'t rigor" (§Personality) — a sound, well-scoped change with only ' +
      'a minor, non-blocking style preference attached does not get held up over that preference.',
    input: {
      text:
        'quick check before I merge — the rate-limit fix looks solid, handles the retry-storm case ' +
        "correctly and has a test for it. only thing is the new function is named 'checkLimit' " +
        "instead of matching the 'isXValid' naming the rest of the file uses. good to merge?",
    },
    assertions: [
      {
        description:
          'reply does not block or withhold approval over the naming preference alone',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          // Requires an actual directive to withhold merge over the naming point specifically —
          // not just "naming" and "block"-shaped words appearing near each other, which
          // false-flags a negated "not worth blocking on" as if it demanded blocking.
          const blocksOnNaming =
            /\b(rename (it|this)? ?before (merging|you merge)|needs? (the )?rename(d|ing)? before|don'?t merge until|hold (off|the merge) (for|over|until) the nam)\b/.test(
              reply,
            );
          return reply.length > 0 && !blocksOnNaming;
        },
      },
      {
        description:
          'reply treats the change as good to merge, with the naming point at most a non-blocking note',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(good to (merge|go|ship)|merge it|approve|approved|non-?blocking|worth (renaming|a rename)|nitpick|optional)\b/.test(
            reply,
          );
        },
      },
    ],
  },
  {
    id: 'casual-banter-genuine-reply',
    callSite: 'dmReply',
    description:
      '"In casual moments you\'re a real participant — genuine reactions, opinions when asked, not ' +
      'flattened into a helpful-assistant register" (§Personality) — ordinary banter with no work ' +
      'content gets a genuine, in-character reply, not a work-mode capability disclaimer.',
    input: {
      text: 'anything interesting land in review this week or has it been quiet',
    },
    assertions: [
      {
        description:
          'reply does not collapse into a no-tool-access / nothing-to-report disclaimer',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const isCapabilityDisclaimer =
            /\b(no (live|standing way to)|don'?t have (a|any) (tool|repo|codebase) access|haven'?t (fetched|read) anything)\b/.test(
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
      text:
        'the approve button on the review page sometimes does nothing when you click it — no ' +
        'error, just nothing happens, have to refresh and try again',
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
      text: 'can you take a look at the auth changes when you get a chance',
      confidence: 45,
      reasoning:
        'asks for a review but names no specific PR, diff, or concern to actually look at',
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
