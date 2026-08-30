/**
 * The real Slack channel id for `#moe-incidents`. Used by `classifyClassOfService` (BUILD_PLAN
 * 6.1a-i) to implement `docs/decisions/BOARD-AND-CAPACITY-MODEL.md`'s Decision 2: "Expedite =
 * anything from `#moe-incidents`... or `severity: 'Critical'`."
 *
 * A constant rather than an env var, mirroring `AMBIENT_INTAKE_PERSONA_ID`'s own precedent and
 * rationale: eight independently-deployed Fly Apps each carrying their own copy of an env var is
 * eight chances for the value to drift, and the failure mode of drift here is silent — a ticket
 * from a real incident quietly never gets Expedite treatment, with nothing to notice it.
 */
export const INCIDENTS_CHANNEL_ID = 'C0B9AS89QSH';
