import type {
  ChannelScopeConfig,
  MessageSurface,
} from './channel-scope-config.js';

/**
 * VISION §5.2's Stage 0 — "a message only enters the pipeline if it's in a channel/DM the team
 * already treats as work-relevant." A `dm` surface always passes (§5.3 — already unambiguous,
 * handled by the addressed persona's own app); a `channel` surface passes only when its ID is in
 * the configured work-relevant set.
 */
export function isSurfaceInScope(
  surface: MessageSurface,
  config: ChannelScopeConfig,
): boolean {
  if (surface.kind === 'dm') {
    return true;
  }
  return config.workRelevantChannelIds.has(surface.channelId);
}
