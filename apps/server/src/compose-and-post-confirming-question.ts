import type { HandlerDeps } from './handle-inbound-message.js';
import type { InboundMessage } from '@moe/slack';

import { addReaction, postMessage } from '@moe/slack';

import { repositoryErrorMessage } from './repository-error.js';
import {
  isCostAndRhythmGuardSatisfied,
  isSituationallyAppropriate,
} from './standing-proactive-guards.js';

const ACTION_DESCRIPTION = 'confirming-question posting';

// VISION §5.2's Mid-band reaction legend — 👍 (yes, draft it) / 👎 (no) — deliberately distinct
// from the High-band 📦/🔁/✅ legend so a later reaction-outcome dispatch (BUILD_PLAN 3.4b-ii) can
// tell the two apart by reaction name alone, no message-type lookup collision to resolve. Slack's
// own `reaction_added` event sends the descriptive alias, not GitHub-style `+1`/`-1` shorthand —
// confirmed against Slack's own published event reference (its own example payload literally
// shows `"reaction": "thumbsup"`), not guessed from `iamcal/emoji-data`'s primary/alias field
// split, which would have given the wrong answer here.
const ANSWER_REACTION_LEGEND = ['👍', '👎'] as const;
const REACTION_NAME_BY_LEGEND_EMOJI: Readonly<
  Record<(typeof ANSWER_REACTION_LEGEND)[number], string>
> = {
  '👍': 'thumbsup',
  '👎': 'thumbsdown',
};

// VISION §5.2's "short, low-friction confirming question" — a fixed template, not an LLM-composed
// one (Alex confirmed via `AskUserQuestion`): no new billed call site, and the question's own
// wording is cheap to change later since it's a plain string, not a schema/architecture choice.
function formatConfirmingQuestionText(): string {
  return (
    'This might be worth tracking — want me to draft a ticket for it? ' +
    'React 👍 to draft it, or 👎 if not.'
  );
}

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — mirrors `handle-ambient-channel-message.ts`'s own `seedReactionLegend`
// exactly, including its "log one failed reaction, still attempt the rest" behavior.
type SeedAnswerLegendInput = {
  readonly message: InboundMessage;
  readonly questionMessageTs: string;
  readonly remaining: readonly (typeof ANSWER_REACTION_LEGEND)[number][];
};

async function seedAnswerLegend(
  deps: HandlerDeps,
  input: SeedAnswerLegendInput,
): Promise<void> {
  const [emoji, ...rest] = input.remaining;
  if (emoji === undefined) return;

  const added = await addReaction(deps.slackClient, {
    channelId: input.message.channelId,
    messageTs: input.questionMessageTs,
    reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
  });
  if (!added.ok) {
    deps.logger.error('failed to add confirming-question legend reaction', {
      personaId: deps.personaId,
      channelId: input.message.channelId,
      reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
      message: added.error.message,
    });
  }

  await seedAnswerLegend(deps, { ...input, remaining: rest });
}

// Bundled into one object, not 3 more params — would otherwise cross eslint's `max-params: 3`,
// same reasoning `standing-proactive-guards.ts`'s own `StandingProactiveGuardInput` documents.
// `classified` carries the Stage 1 classifier's own confidence/reasoning through so a future 👎
// answer (BUILD_PLAN 3.4b-ii) can log it to `review_queue` with the same context the Low-band path
// already provides — no live 👍/👎 consumer exists yet, same "build the primitive" shape
// 2.7a/2.7b/3.2/3.4a-ii all used.
export type ComposeAndPostConfirmingQuestionInput = {
  readonly message: InboundMessage;
  readonly now: Date;
  readonly classified: {
    readonly confidence: number;
    readonly reasoning: string;
  };
};

// Extracted from `composeAndPostConfirmingQuestion` purely to stay under eslint's
// `max-lines-per-function` (`docs/CONVENTIONS.md` §Code Style) — posts the fixed-template
// question, persists the `pending_confirming_questions` row keyed on the real posted message, and
// seeds the 👍/👎 legend, same shape as `handle-ambient-channel-message.ts`'s own
// `postAndPersistDraft`.
async function postAndPersistConfirmingQuestion(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<void> {
  const { message, classified } = input;
  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: formatConfirmingQuestionText(),
    threadTs: message.ts,
  });
  if (!posted.ok) {
    deps.logger.error('failed to post confirming question', {
      message: posted.error.message,
    });
    return;
  }

  const created = await deps.confirmingQuestionStore.create({
    personaId: deps.personaId,
    channelId: message.channelId,
    messageTs: posted.ts,
    sourceMessageTs: message.ts,
    sourceMessageText: message.text,
    confidence: classified.confidence,
    reasoning: classified.reasoning,
  });
  if (!created.ok) {
    deps.logger.error('failed to persist pending confirming question', {
      message: repositoryErrorMessage(created.error),
    });
    return;
  }

  await seedAnswerLegend(deps, {
    message,
    questionMessageTs: posted.ts,
    remaining: ANSWER_REACTION_LEGEND,
  });

  deps.logger.info('posted mid-band confirming question', {
    personaId: deps.personaId,
    channelId: message.channelId,
    questionId: created.question.id,
  });
}

/**
 * BUILD_PLAN 3.4b-i's Mid-band action: gated by the same cost-cap+operating-rhythm guard and
 * situational-appropriateness gate the High-band draft path uses
 * (`standing-proactive-guards.ts`), then posts a fixed-template confirming question in-thread on
 * the source message, persists a `pending_confirming_questions` row keyed on the posted message,
 * and seeds the 👍/👎 legend (`postAndPersistConfirmingQuestion`).
 */
export async function composeAndPostConfirmingQuestion(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<void> {
  const { message, now } = input;
  const guardInput = { message, now, actionDescription: ACTION_DESCRIPTION };
  const guardsPassed = await isCostAndRhythmGuardSatisfied(deps, guardInput);
  if (!guardsPassed) return;

  const gatePassed = await isSituationallyAppropriate(deps, guardInput);
  if (!gatePassed) return;

  await postAndPersistConfirmingQuestion(deps, input);
}
