import { describe, expect, it } from 'vitest';

import { isAway } from './is-away.js';

describe('isAway', () => {
  it('matches a status text keyword as a whole word, case-insensitively', () => {
    expect(isAway({ statusText: 'On Holiday', statusEmoji: '' })).toBe(true);
  });

  it('does not false-positive on a keyword as a substring of an unrelated word', () => {
    expect(
      isAway({ statusText: 'Judging the giveaway contest', statusEmoji: '' }),
    ).toBe(false);
    expect(
      isAway({ statusText: 'On the runaway train', statusEmoji: '' }),
    ).toBe(false);
  });

  it('matches OOO as a whole word', () => {
    expect(isAway({ statusText: 'OOO until Thursday', statusEmoji: '' })).toBe(
      true,
    );
  });

  it('matches a colon-wrapped status emoji shortcode', () => {
    expect(isAway({ statusText: '', statusEmoji: ':palm_tree:' })).toBe(true);
  });

  it('matches an emoji shortcode case-insensitively', () => {
    expect(isAway({ statusText: '', statusEmoji: ':Palm_Tree:' })).toBe(true);
  });

  it('returns false when neither text nor emoji match any keyword', () => {
    expect(
      isAway({
        statusText: 'In a meeting',
        statusEmoji: ':spiral_calendar_pad:',
      }),
    ).toBe(false);
  });

  it('returns true when either signal alone matches, without requiring both', () => {
    expect(
      isAway({ statusText: 'In a meeting', statusEmoji: ':palm_tree:' }),
    ).toBe(true);
    expect(
      isAway({ statusText: 'On holiday', statusEmoji: ':calendar:' }),
    ).toBe(true);
  });

  it('treats a keyword containing regex metacharacters as a literal string, not a pattern', () => {
    const customKeywords = { textKeywords: ['b.r.b'], emojiShortcodes: [] };
    expect(
      isAway(
        { statusText: 'Back in a sec, b.r.b', statusEmoji: '' },
        customKeywords,
      ),
    ).toBe(true);
    // "." is regex-any-character if unescaped — "bxrxb" would wrongly match a leaked-through
    // pattern where a real, properly-escaped literal "." must not.
    expect(
      isAway(
        { statusText: 'bxrxb makes no sense', statusEmoji: '' },
        customKeywords,
      ),
    ).toBe(false);
  });

  it('respects a custom keyword list over the default', () => {
    const customKeywords = {
      textKeywords: ['gone fishing'],
      emojiShortcodes: ['fishing_pole_and_fish'],
    };
    expect(
      isAway({ statusText: 'On holiday', statusEmoji: '' }, customKeywords),
    ).toBe(false);
    expect(
      isAway({ statusText: 'Gone Fishing', statusEmoji: '' }, customKeywords),
    ).toBe(true);
  });
});
