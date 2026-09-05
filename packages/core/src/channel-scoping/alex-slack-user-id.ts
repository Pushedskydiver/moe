/**
 * Alex's real Slack user id, for the reaction-approval identity check BUILD_PLAN 6.1d needs.
 * VISION §6.3: "Alex's own reactions carry meaning too (👍 on a brief = approval, 🛑 on a PR =
 * hold)" — the approval is special because of *who* reacted, not just the emoji. A hardcoded
 * constant, mirroring `TEAM_CHANNEL_ID`/`INCIDENTS_CHANNEL_ID`'s own precedent and rationale:
 * eight independently-deployed Fly Apps each carrying their own copy of an env var is eight
 * chances for the value to drift, and this value is a real-world fact identical across all
 * eight, not a per-deployment knob.
 */
export const ALEX_SLACK_USER_ID = 'U04UQ6CLZ1U';
