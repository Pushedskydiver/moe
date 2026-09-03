/**
 * The real Slack channel id for `#moe-team`. Used by BUILD_PLAN 6.1b's Brief-stage handler to
 * post Sarah's composed brief for every ticket landing in `Brief`, per Alex's own confirmed scope
 * decision (recorded in `BUILD_PLAN.md`'s own 6.1b entry, not a dedicated `docs/decisions/` file —
 * a Slack message in `#moe-team`, with a persisted ticket→{channelId, messageTs} pointer).
 *
 * A constant rather than an env var, mirroring `INCIDENTS_CHANNEL_ID`'s own precedent and
 * rationale: eight independently-deployed Fly Apps each carrying their own copy of an env var is
 * eight chances for the value to drift.
 */
export const TEAM_CHANNEL_ID = 'C0B88H0JUA3';
