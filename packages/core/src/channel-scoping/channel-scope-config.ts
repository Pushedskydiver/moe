/**
 * VISION §5.2's Stage 0 ("scope the surface") input shape. A `dm` surface is always in scope —
 * §5.3 already settles that a DM sent directly to a named persona is unambiguous and is handled
 * by that persona's own app without Sarah/Stage-0 in the loop at all — so `MessageSurface` only
 * needs to distinguish "channel" (subject to the allow-list below) from "dm" (never checked).
 * Deliberately has no notion of Slack's own `channel_type` (`channel`/`group`/`im`/`mpim`) —
 * `packages/core` has zero Slack dependency; a caller normalizes a real Slack event into this
 * shape before calling `isSurfaceInScope`.
 */
export type MessageSurface =
  | { readonly kind: 'channel'; readonly channelId: string }
  | { readonly kind: 'dm' };

/**
 * `workRelevantChannelIds` holds real Slack channel IDs, which are workspace-specific artifacts
 * with no meaningful code-level default (unlike `CoreHoursConfig`'s clock/weekday values or
 * `AwayKeywords`'s keyword list, both deployment-independent policy) — so there's no
 * `DEFAULT_CHANNEL_SCOPE_CONFIG` here. VISION §6.1's channel table (`#moe-team`,
 * `#moe-incidents`, `#moe-research` in scope; `#moe-random` out) names the *policy*; whichever
 * chunk wires a real Slack listener against this resolves those names to real channel IDs.
 */
export type ChannelScopeConfig = {
  readonly workRelevantChannelIds: ReadonlySet<string>;
};
