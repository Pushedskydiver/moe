import type { Anthropic } from '@anthropic-ai/sdk';

/**
 * Shared by every persona-scoped system-prompt call site (BUILD_PLAN 5.3a-ii) —
 * `buildPersonaSystemPrompt`, `composeTicketDraft`, and `composeConfirmingQuestionLeadIn` all
 * call it (DA review caught this doc going stale twice already as each of the three landed —
 * this is the third and final wiring, closing chunk 5.3a-ii). Drops `undefined`/empty segments,
 * then marks only the *last* remaining block `cache_control`.
 * Deliberately the last block, not the first — every segment here is 100% static per
 * (persona, call-type), so caching everything up to and including the last one (rather than
 * just a leading persona-voice block) captures the whole static prefix as one cached unit
 * instead of leaving a trailing task-instruction block reprocessed at full price on every call.
 *
 * Not the SDK's own top-level `cache_control` shortcut (which marks the last cacheable block in
 * the *entire request*, including `messages`) — that risks the marker landing on the varying
 * user turn instead of the static system prompt. Explicit per-block marking here avoids that.
 */
export function buildCachedSystemBlocks(
  segments: ReadonlyArray<string | undefined>,
): readonly Anthropic.TextBlockParam[] {
  const present = segments.filter(
    (segment): segment is string => segment !== undefined && segment.length > 0,
  );

  return present.map((text, index) => ({
    type: 'text',
    text,
    ...(index === present.length - 1
      ? { cache_control: { type: 'ephemeral' as const } }
      : {}),
  }));
}
