import { describe, expect, it } from 'vitest';

import { isSurfaceInScope } from './is-surface-in-scope.js';

describe('isSurfaceInScope', () => {
  it('treats a DM as always in scope, regardless of config', () => {
    expect(
      isSurfaceInScope({ kind: 'dm' }, { workRelevantChannelIds: new Set() }),
    ).toBe(true);
  });

  it('treats a channel in the work-relevant allow-list as in scope', () => {
    expect(
      isSurfaceInScope(
        { kind: 'channel', channelId: 'C_MOE_TEAM' },
        { workRelevantChannelIds: new Set(['C_MOE_TEAM', 'C_MOE_INCIDENTS']) },
      ),
    ).toBe(true);
  });

  it('treats a channel outside the work-relevant allow-list as out of scope', () => {
    expect(
      isSurfaceInScope(
        { kind: 'channel', channelId: 'C_MOE_RANDOM' },
        { workRelevantChannelIds: new Set(['C_MOE_TEAM', 'C_MOE_INCIDENTS']) },
      ),
    ).toBe(false);
  });
});
