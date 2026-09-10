import type { HandlerDeps } from './handle-inbound-message.js';
import type { GenerateReplyResult } from '@moe/agents';
import type { InboundMessage } from '@moe/slack';

import {
  buildPersonaSystemPrompt,
  composeGatedReply,
  generateReply,
  parseReactInput,
  REACT_TOOL,
  REACT_TOOL_NAME,
  resolvePersonaModel,
  sonnetCostUsdMicros,
  STATUS_CLAIM_TOOL,
  STATUS_CLAIM_TOOL_NAME,
} from '@moe/agents';
import { addReaction, postMessage } from '@moe/slack';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { recordUsageLogged } from './record-usage-logged.js';

// Non-persona-voiced, same spirit as chunk 2.3's ACK_TEXT — a visible reply on LLM failure beats
// the silent-to-the-user gap a bare "log and stop" would leave (caught live: DA review on chunk
// 2.4a's own PR, comparing against chunk 2.3's baseline where every inbound message got a visible
// ack). Retry/backoff itself stays out of scope.
const FALLBACK_TEXT =
  "Sorry, I ran into a problem generating a reply — I've logged it.";

// Posted to the user's own channel/thread, not Alex's alert DM (`check-cost-cap.ts`'s own
// `costAlertText`) — a hard halt (BUILD_PLAN 2.6b) needs its own visible signal same as
// `FALLBACK_TEXT`, "never silent" per the DM path's own established precedent. That precedent is
// what BUILD_PLAN 3.7's governing invariant generalizes: the DM path always posts *something*, so
// the intake cascade may only ever add to that response, never remove it.
const HALT_TEXT =
  "I've hit my monthly budget cap and can't generate a new reply right now — I'll be back once it resets next month.";

export type GenerateAndPostResult =
  | { readonly ok: true; readonly outcome: 'replied'; readonly text: string }
  | { readonly ok: true; readonly outcome: 'reacted' }
  | { readonly ok: false };

async function postHaltReply(
  deps: HandlerDeps,
  message: InboundMessage,
): Promise<void> {
  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: HALT_TEXT,
    ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post halt reply', {
      errorMessage: posted.error.message,
    });
  }
}

/**
 * Live in production as of BUILD_PLAN 6.1g — `generateAndPost`'s own real `tools` array includes
 * `REACT_TOOL`, grounded in every persona's own `prompt.md` (do-not-touch, drafted with Alex).
 * Returns `undefined` (not a `{ok: false}`-shaped result) when there is no valid `react` call to
 * act on — the caller's own signal to fall through to the ordinary reply-composition path
 * unchanged. Only the first `react` call is honored if the model calls it more than once in a turn
 * — same accepted-edge-case shape `compose-gated-reply.ts` already documents for repeated
 * `report_status` calls.
 */
async function dispatchReactToolUse(
  deps: HandlerDeps,
  message: InboundMessage,
  generated: Extract<GenerateReplyResult, { readonly ok: true }>,
): Promise<GenerateAndPostResult | undefined> {
  const reactCall = generated.toolUses.find(
    (toolUse) => toolUse.name === REACT_TOOL_NAME,
  );
  const reaction =
    reactCall !== undefined ? parseReactInput(reactCall.input) : undefined;
  if (reaction === undefined) return undefined;

  const statusCallAlsoPresent = generated.toolUses.some(
    (toolUse) => toolUse.name === STATUS_CLAIM_TOOL_NAME,
  );
  if (statusCallAlsoPresent) {
    deps.logger.info(
      'model called both report_status and react in the same turn, react wins',
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        messageTs: message.ts,
        reaction,
      },
    );
  }

  const reacted = await addReaction(deps.slackClient, {
    channelId: message.channelId,
    messageTs: message.ts,
    reactionName: reaction,
  });
  if (!reacted.ok) {
    deps.logger.error('failed to post acknowledgement reaction', {
      errorMessage: reacted.error.message,
    });
  }

  return { ok: true, outcome: 'reacted' };
}

/**
 * Composes the gated reply text once (reused for both the Slack post and the caller's own
 * persisted/buffered history entry, so the two can never drift apart — avoids redundant work now,
 * and once Stage 6 wires in real evidence that could itself change between calls, e.g. a
 * re-fetched CI status, a second `composeGatedReply` call could otherwise return a different
 * result than the first), posts it, and reports the outcome.
 */
async function composeAndPostReply(
  deps: HandlerDeps,
  message: InboundMessage,
  params: { readonly generated: GenerateReplyResult; readonly now: Date },
): Promise<GenerateAndPostResult> {
  const { generated, now } = params;
  const text = generated.ok
    ? composeGatedReply(generated, () => now.toISOString())
    : FALLBACK_TEXT;

  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text,
    ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post reply', {
      errorMessage: posted.error.message,
    });
  }

  return generated.ok ? { ok: true, outcome: 'replied', text } : { ok: false };
}

/**
 * The DM conversational-reply path (BUILD_PLAN 2.4a/2.4b/2.5/2.6b), extracted from
 * `handle-inbound-message.ts` purely to keep that file under eslint's `max-lines`
 * (`docs/CONVENTIONS.md` §Code Style) once BUILD_PLAN 3.7's cascade wiring landed there — a pure
 * move, no behaviour change, proven by every pre-existing test in
 * `handle-inbound-message.test.ts` staying green unchanged.
 *
 * Never silent: a cost-cap halt posts `HALT_TEXT`, a failed LLM call posts `FALLBACK_TEXT`, and a
 * success posts the gated reply. That is the property BUILD_PLAN 3.7's invariant protects — the
 * intake cascade falls through to this function on *every* outcome that isn't a successfully
 * posted draft or confirming question.
 */
export async function generateAndPost(
  deps: HandlerDeps,
  message: InboundMessage,
  history: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>,
): Promise<GenerateAndPostResult> {
  // One clock read shared by the cap check, cost accounting, and the gated-reply compose below,
  // not a fresh `new Date()` per use — keeps all three derived from the exact same instant.
  const now = new Date();

  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    await postHaltReply(deps, message);
    // `ok: true`, not `false` — matches the line below's own "ok reflects whether there's real
    // reply content to persist, independent of Slack delivery success" precedent. A halt genuinely
    // produced a reply (`HALT_TEXT`, just posted above); persisting it to conversation history
    // means a real month-long halt doesn't leave the history silently diverging from what the user
    // actually saw in Slack — a plain LLM failure (below) has no such content to persist, which is
    // the one case `ok: false` still covers.
    return { ok: true, outcome: 'replied', text: HALT_TEXT };
  }

  const generated = await generateReply(deps.anthropicClient, {
    text: message.text,
    history,
    system: await buildPersonaSystemPrompt(deps.personaId, deps.logger),
    model: resolvePersonaModel(deps.personaId),
    // REACT_TOOL (react-tool.ts) is live here as of BUILD_PLAN 6.1g — every persona's own
    // prompt.md now grounds it (do-not-touch, drafted with Alex), so the model has real guidance
    // on when to reach for it rather than just its raw tool description.
    tools: [STATUS_CLAIM_TOOL, REACT_TOOL],
  });

  if (!generated.ok) {
    deps.logger.error('failed to generate reply', {
      errorMessage: generated.error.message,
    });
  } else {
    await recordUsageLogged(
      deps,
      {
        usage: generated.usage,
        costUsdMicros: sonnetCostUsdMicros(generated.usage, now),
      },
      now,
    );
  }

  if (generated.ok) {
    const reacted = await dispatchReactToolUse(deps, message, generated);
    if (reacted !== undefined) return reacted;
  }

  return composeAndPostReply(deps, message, { generated, now });
}
