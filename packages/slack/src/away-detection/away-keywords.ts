/** The keyword/emoji shape `is-away.ts`'s `isAway` matches a Slack status against. */
export type AwayKeywords = {
  readonly textKeywords: readonly string[];
  readonly emojiShortcodes: readonly string[];
};

/**
 * VISION Appendix A's open "Slack-status-away parsing conventions" question, settled at
 * BUILD_PLAN chunk 2.7b (Alex confirmed via `AskUserQuestion`, not inferred): BUILD_PLAN's own
 * illustrative text keywords (`away`, `holiday`, `OOO`) kept as-is; the emoji set widened past
 * BUILD_PLAN's two named examples (🌴/🏖️) to cover the other common Slack away-signal categories
 * — travel (✈️) and illness/medical (🤒🌡️🏥) — while deliberately excluding ambiguous
 * momentary-busy signals (🔴 do-not-disturb, 🏠 WFH) that don't reliably mean "extended absence"
 * the way a holiday/travel/sick emoji does; a false "away" positive on those would wrongly
 * suppress a persona's normal proactive behavior. `emojiShortcodes` are colon-free shortcode
 * names (`Profile.status_emoji` from `@slack/web-api`'s own `UsersProfileGetResponse` type comes
 * back colon-wrapped, e.g. `:palm_tree:` — `is-away.ts` strips the colons before comparing), each
 * verified against the real `iamcal/emoji-data` short-name database rather than guessed — a past
 * session's own "Slack emoji shortcode gotcha" confirmed the obvious-sounding name is sometimes
 * wrong (🔁 is `repeat`, not `arrows_counterclockwise`); this list caught a second live instance
 * of the same gotcha (🏖️ is `beach_with_umbrella`, not the guessed `beach_umbrella`).
 */
export const DEFAULT_AWAY_KEYWORDS: AwayKeywords = {
  textKeywords: ['away', 'holiday', 'OOO'],
  emojiShortcodes: [
    'palm_tree',
    'beach_with_umbrella',
    'airplane',
    'face_with_thermometer',
    'thermometer',
    'hospital',
  ],
};
