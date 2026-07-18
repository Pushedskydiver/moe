import { describe, expect, it } from 'vitest';

import { parseChannelScopeConfig } from './channel-scope-config.js';

describe('parseChannelScopeConfig', () => {
  it('parses a comma-separated env var into a ChannelScopeConfig with a Set of channel IDs', () => {
    const result = parseChannelScopeConfig({
      MOE_WORK_RELEVANT_CHANNEL_IDS: 'C_TEAM,C_INCIDENTS,C_RESEARCH',
    });

    expect(result.ok).toBe(true);
    expect(result.ok && [...result.config.workRelevantChannelIds]).toEqual([
      'C_TEAM',
      'C_INCIDENTS',
      'C_RESEARCH',
    ]);
  });

  it('trims whitespace around each channel ID and drops empty entries from stray commas', () => {
    const result = parseChannelScopeConfig({
      MOE_WORK_RELEVANT_CHANNEL_IDS: ' C_TEAM ,, C_INCIDENTS,',
    });

    expect(result.ok && [...result.config.workRelevantChannelIds]).toEqual([
      'C_TEAM',
      'C_INCIDENTS',
    ]);
  });

  it('returns ok:false when the env var is missing', () => {
    const result = parseChannelScopeConfig({});

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when the env var is present but empty or all-whitespace/commas', () => {
    expect(
      parseChannelScopeConfig({ MOE_WORK_RELEVANT_CHANNEL_IDS: '' }).ok,
    ).toBe(false);
    expect(
      parseChannelScopeConfig({ MOE_WORK_RELEVANT_CHANNEL_IDS: ' , ,' }).ok,
    ).toBe(false);
  });
});
