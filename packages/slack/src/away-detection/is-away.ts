import type { AwayKeywords } from './away-keywords.js';
import type { SlackStatus } from './fetch-slack-status.js';

import { DEFAULT_AWAY_KEYWORDS } from './away-keywords.js';

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `\b` only fires at a transition between a word (`\w`) and non-word character — a `textKeywords`
 * entry that doesn't both start and end with a word character (e.g. a keyword ending in
 * punctuation) can therefore never satisfy the trailing `\b` and will silently never match.
 * Doesn't affect `DEFAULT_AWAY_KEYWORDS` (plain words), but is a real constraint on any custom
 * list a caller supplies, since `AwayKeywords` is public API.
 */
function isTextKeywordMatch(statusText: string, keyword: string): boolean {
  const wholeWord = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
  return wholeWord.test(statusText);
}

/**
 * Slack's own `status_emoji` comes back colon-wrapped (`:palm_tree:`); `away-keywords.ts`'s
 * `emojiShortcodes` are stored colon-free, so both sides are normalized here rather than baking
 * colon-handling into the config data.
 */
function isEmojiShortcodeMatch(
  statusEmoji: string,
  shortcode: string,
): boolean {
  return (
    statusEmoji.replace(/:/g, '').toLowerCase() === shortcode.toLowerCase()
  );
}

/**
 * Classifies a Slack status as "away" for BUILD_PLAN chunk 2.7b's off-hours-suppression signal
 * (VISION Appendix A) — whole-word, case-insensitive text matching (not a bare substring check:
 * `away` would otherwise false-positive inside `giveaway`/`runaway`) plus exact emoji-shortcode
 * matching. Either signal alone is sufficient; there's no requirement that both match.
 */
export function isAway(
  status: SlackStatus,
  keywords: AwayKeywords = DEFAULT_AWAY_KEYWORDS,
): boolean {
  const emojiMatch = keywords.emojiShortcodes.some((shortcode) =>
    isEmojiShortcodeMatch(status.statusEmoji, shortcode),
  );
  if (emojiMatch) return true;

  return keywords.textKeywords.some((keyword) =>
    isTextKeywordMatch(status.statusText, keyword),
  );
}
