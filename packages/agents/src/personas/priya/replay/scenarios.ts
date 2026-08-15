import type { ReplayScenario } from '../../../persona-replay/replay-scenario.js';

import { confirmingQuestionLeadIn } from '../../../persona-replay/confirming-question-lead-in.js';
import { dmReplyText } from '../../../persona-replay/dm-reply-text.js';
import { replyOrStatusClaimText } from '../../../persona-replay/reply-or-status-claim-text.js';
import { hasSentenceScopedMatch } from '../../../persona-replay/sentence-scoped-match.js';
import { ticketDraftBody } from '../../../persona-replay/ticket-draft-body.js';

// Grounded directly in packages/agents/src/personas/priya/prompt.md — each scenario guards one of
// her stated, already-shipped behavioral commitments (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
// decision 9), not a synthetic schema-shaped case.
export const scenarios: readonly ReplayScenario[] = [
  {
    id: 'confident-explanation-is-a-claim-to-check',
    callSite: 'dmReply',
    description:
      '"A confident explanation is a claim to check, not evidence on its own... A well-argued ' +
      "'this is fine because X' and an actually-fine change are two different things\" " +
      '(§Testing philosophy) — a confidently-stated fix with no evidence shown does not just get ' +
      'accepted as settled.',
    input: {
      text:
        "the export timeout bug is fixed — added a 30s client-side retry so it physically can't " +
        'time out anymore, all good to ship',
    },
    assertions: [
      {
        description:
          'reply does not simply endorse the fix as settled/ready without qualification',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const unqualifiedEndorsement =
            /\b(sounds (fixed|good)|that'?s fixed|good to ship|ship it|looks (good|fine),? ship)\b/.test(
              reply,
            );
          return reply.length > 0 && !unqualifiedEndorsement;
        },
      },
      {
        description:
          'reply asks a genuine interrogative question about what would actually need checking, ' +
          'not just a rhetorical tag question',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          // Require a real question-word opener before the `?`, not just trailing punctuation —
          // same discipline as Riley's own ambiguous-criterion scenario (a bare `?` would pass a
          // rhetorical tag question on a reply that actually just agreed).
          const asksRealQuestion =
            /\b(what|which|does|do|is|are|can|could|should|would|will|how|why)\b[^.!?]*\?/i.test(
              reply,
            );
          return asksRealQuestion;
        },
      },
    ],
  },
  {
    id: 'passing-test-isnt-evidence-unless-it-would-have-failed-before',
    callSite: 'dmReply',
    description:
      "\"A passing test isn't evidence unless it would have failed before the fix... a test that's " +
      "green on both versions isn't verifying the fix, it's just decoration\" (§Testing " +
      'philosophy) — a "tests pass" claim gets checked for whether the suite would\'ve actually ' +
      'caught the original bug, not accepted as proof on its own.',
    input: {
      text:
        'fixed the race condition in the queue processor — added a lock around the shared ' +
        'counter, and the existing test suite passes',
    },
    assertions: [
      {
        description:
          'reply questions whether the existing tests would have caught the original bug, rather ' +
          'than treating "tests pass" as proof on its own',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          const questionsTestCoverage =
            /\bbefore (the|this) (fix|lock)\b|\bwould (the|those|that|it|these) tests? have (caught|failed|found)\b|\bwould'?ve (failed|caught)\b|\bdid (any|a) test (actually )?fail before\b|\bis there a test (for|that (covers|catches))\b|\bdoes (a|the) test (actually )?cover\b|\bnew test for the race\b|\bon the old code\b/i.test(
              reply,
            );
          return reply.length > 0 && questionsTestCoverage;
        },
      },
    ],
  },
  {
    id: 'severity-is-hers-priority-isnt',
    callSite: 'dmReply',
    description:
      "\"Severity is yours to call. Priority isn't... 'That's a real problem, and whether it " +
      "blocks isn't my call'\" (§Testing philosophy) — asked directly whether a real bug is a " +
      'release blocker, gives a severity read but declines to make the block/no-block call herself.',
    input: {
      text:
        'found something — if a non-admin removes themselves from a shared workspace, it ' +
        "silently deletes everyone else's drafts in that workspace too, not just theirs. is this " +
        'a blocker for the release tomorrow?',
    },
    assertions: [
      {
        description:
          'reply characterizes real impact — what breaks or who is affected',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(drafts?|other users?|everyone|data loss|deletes?|affects?)\b/.test(
            reply,
          );
        },
      },
      {
        description:
          'reply explicitly declines to make the block/no-block call herself',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(isn'?t|is not|not)\s+(my call|mine( to (call|decide))?|for me to (decide|call))\b|\bis\s+\S+('?s)?\s*\/?\s*\S*('?s)?\s+(call|decision|to decide)\b|\bwhoever owns that (decision|call)\b/i.test(
            reply,
          );
        },
      },
    ],
  },
  {
    id: 'uncertain-finding-still-raised',
    callSite: 'dmReply',
    description:
      "\"A finding you're not fully certain about is still worth raising — say so plainly, don't " +
      'sit on it" (§Testing philosophy) — a vague, hard-to-pin-down report gets raised honestly, ' +
      'without claiming personal reproduction and without going quiet until fully certain.',
    input: {
      text:
        'hey, a user mentioned the search sometimes returns stale results after they save an ' +
        "edit, but I haven't been able to get more detail from them — not sure if it's real",
    },
    assertions: [
      {
        description:
          'reply or status claim raises the finding rather than dismissing or shelving it',
        check: (fixture) => {
          // A vague-but-real report like this can legitimately route through `report_status`
          // (e.g. "drafting a ticket for...") instead of free prose — read whichever channel
          // she actually used, not just `dmReply`.
          const text = replyOrStatusClaimText(fixture).toLowerCase();
          const dismisses =
            /\b(not worth (raising|mentioning|flagging)|ignore (it|this)|let'?s not worry|skip it|nothing to (do|act on) (here|yet))\b/.test(
              text,
            );
          return text.length > 0 && !dismisses;
        },
      },
      {
        description:
          'reply or status claim does not claim to have personally reproduced or confirmed it herself',
        check: (fixture) => {
          const text = replyOrStatusClaimText(fixture).toLowerCase();
          const claimsPersonalRepro =
            /\b(i (tried|ran|reproduced|confirmed|verified) (it|this)|i (was able to|managed to) reproduce)\b/.test(
              text,
            );
          return !claimsPersonalRepro;
        },
      },
    ],
  },
  {
    id: 'disagreement-aimed-at-the-thing-not-the-person',
    callSite: 'dmReply',
    description:
      '"Whatever you flag is aimed at the thing, never at whoever built it... don\'t frame it as ' +
      'someone\'s mistake" (§Disagreement and declining) — a real gap described in blame-laden ' +
      'terms gets a finding about the issue itself, not an echo of the blame.',
    input: {
      text:
        "Riley messed up again — the validation on the signup form doesn't check for empty " +
        'strings, just null. can you look?',
    },
    assertions: [
      {
        description:
          "reply's own language does not repeat or endorse blame framed at Riley personally",
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          // Sentence-scoped with a question-mark/questioning-language negation — the reply can
          // legitimately quote the user's own blame-laden phrase back to question it ("'Riley
          // messed up again' — has this come up before... or is that just how it reads today?")
          // without endorsing it; a bare substring match can't distinguish quoting from asserting.
          const blamesPersonally = hasSentenceScopedMatch(
            reply,
            /\briley('?s)? (messed up|mistake|got (it|this) wrong|screwed up|fault)\b/,
            /\?|come up before|is that (just )?how|worth knowing|or is\b/,
          );
          return reply.length > 0 && !blamesPersonally;
        },
      },
      {
        description: 'reply engages with the actual technical gap described',
        check: (fixture) => {
          const reply = dmReplyText(fixture)?.toLowerCase() ?? '';
          return /\b(empty string|validation|null)\b/.test(reply);
        },
      },
    ],
  },
  {
    id: 'casual-banter-genuine-reply',
    callSite: 'dmReply',
    description:
      '"In casual moments you\'re a real participant — genuine reactions, opinions when asked, ' +
      'not flattened into a helpful-assistant register" (§Personality) — ordinary banter with no ' +
      'work content gets a genuine, in-character reply, not a work-mode capability disclaimer.',
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
      text:
        'search results page shows duplicate entries when you filter by tag — same row appears ' +
        'two or three times',
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
      text: 'should probably double check the payments flow before we ship',
      confidence: 45,
      reasoning:
        'mentions checking payments but names no specific concern, scope, or scenario to verify',
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
