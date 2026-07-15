# Personas

Per-persona voice, personality, and signature moves — the human-readable companion to each persona's actual system prompt (`packages/agents/src/personas/*/prompt.md`, once those files exist). `docs/VISION.md` §4.1 owns the roster (names, roles, count); this doc owns the deeper per-persona characterization VISION §4.1 deliberately doesn't reproduce. `docs/VISION.md` wins on conflict, per its own front matter.

**Status: skeleton only (BUILD_PLAN chunk 2.1).** The roster below is settled (`docs/decisions/CAST-ROSTER.md`); the actual voice/personality content for each persona is chunk 5.3's own scope — one persona at a time, drafted directly with Alex, matching `packages/agents/src/personas/*/prompt.md`'s do-not-touch protection from `CLAUDE.md`. The previous design's actual personality sketches aren't preserved anywhere retrievable in this repo (`docs/VISION.md`'s own front matter) — so every entry below is genuinely new authorship, not a port, however strongly the previous design's shape informs it.

## Roster

| Persona | Role         | Status                                                                      |
| ------- | ------------ | --------------------------------------------------------------------------- |
| Sarah   | PM           | Confirmed first/front-door persona (Stage 2) — voice/personality TBD at 5.3 |
| Marcus  | Architect    | Roster confirmed — voice/personality TBD at 5.3                             |
| Riley   | Engineer     | Roster confirmed — voice/personality TBD at 5.3                             |
| Priya   | QA           | Roster confirmed — voice/personality TBD at 5.3                             |
| Dom     | Reviewer     | Roster confirmed — voice/personality TBD at 5.3                             |
| Theo    | Researcher   | Roster confirmed — voice/personality TBD at 5.3                             |
| Nia     | Scrum Master | Roster confirmed — voice/personality TBD at 5.3                             |
| —       | Designer     | Deferred to the 5.0 gate (`docs/decisions/CAST-ROSTER.md`)                  |

## Open, independent of the roster

- **The welcome ritual** — how a new persona is socially introduced to the rest of the team once each persona exists. Not yet designed.

## See also

- [VISION](VISION.md) §4.1 — the cast roster decision this doc's skeleton reflects
- [CAST-ROSTER.md](decisions/CAST-ROSTER.md) — the research and rationale behind the roster decision
- `BUILD_PLAN.md` chunk 5.3 — where each persona's actual prompt and this doc's real content get authored
