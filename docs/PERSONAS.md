# Personas

Per-persona voice, personality, and signature moves — the human-readable companion to each persona's actual system prompt (`packages/agents/src/personas/*/prompt.md`, once those files exist). `docs/VISION.md` §4.1 is the **authoritative** source for the roster (names, roles, count); the table below mirrors it for reference convenience only and must change in lockstep, under the same do-not-touch protection as §4.1 itself (`CLAUDE.md` §Non-obvious constraints). This doc's own unique content — the deeper per-persona characterization VISION §4.1 deliberately doesn't reproduce — doesn't exist yet. `docs/VISION.md` wins on conflict, per its own front matter.

**Status: skeleton only (BUILD_PLAN chunk 2.1).** The roster below is settled (`docs/decisions/CAST-ROSTER.md`); the actual voice/personality content for each persona is chunk 5.3's own scope — one persona at a time, drafted directly with Alex, matching `packages/agents/src/personas/*/prompt.md`'s do-not-touch protection from `CLAUDE.md`. The previous design's actual personality sketches aren't preserved anywhere retrievable in this repo (`docs/VISION.md`'s own front matter) — so every entry below is genuinely new authorship, not a port, however strongly the previous design's shape informs it.

## Roster

| Persona | Role         | Status                                                                                                                                                                 |
| ------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sarah   | PM           | Confirmed first/front-door persona (Stage 2) — real `prompt.md` drafted and deployed (BUILD_PLAN 5.3a, [PR #83](https://github.com/Pushedskydiver/moe/pull/83))        |
| Marcus  | Architect    | Real `prompt.md` drafted and merged (BUILD_PLAN 5.3c, [PR #92](https://github.com/Pushedskydiver/moe/pull/92)) — not yet deployed                                      |
| Riley   | Engineer     | Real `prompt.md` drafted and merged (BUILD_PLAN 5.3d, [PR #94](https://github.com/Pushedskydiver/moe/pull/94)) — not yet deployed                                      |
| Priya   | QA           | Roster confirmed — voice/personality TBD at 5.3                                                                                                                        |
| Dom     | Reviewer     | Roster confirmed — voice/personality TBD at 5.3                                                                                                                        |
| Theo    | Researcher   | Roster confirmed — voice/personality TBD at 5.3                                                                                                                        |
| Nia     | Scrum Master | Roster confirmed — voice/personality TBD at 5.3                                                                                                                        |
| Maya    | Designer     | Roster confirmed (BUILD_PLAN chunk 5.0, 2026-07-24) — real `prompt.md` drafted and deployed (BUILD_PLAN 5.3b, [PR #89](https://github.com/Pushedskydiver/moe/pull/89)) |

## Open, independent of the roster

- **The welcome ritual** — how a new persona is socially introduced to the rest of the team once each persona exists. Not yet designed.

## See also

- [VISION](VISION.md) §4.1 — the authoritative cast roster this doc's table mirrors
- [CAST-ROSTER.md](decisions/CAST-ROSTER.md) — the research and rationale behind the roster decision
- `BUILD_PLAN.md` chunk 5.3 — where each persona's actual prompt and this doc's real content get authored
