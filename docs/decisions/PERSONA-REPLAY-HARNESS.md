---
status: Decided
date: 2026-08-09
---

# Persona-Replay Test Harness

## Decision

Two separate mechanisms: a manual recording script (`packages/agents/scripts/record-persona-replay.ts`) hitting the real Anthropic API, and a network-free `persona-replay.test.ts` per persona wired into `pnpm test`. A fixture's stored content-hashes of `prompt.md` and the scenario's own input, plus its resolved model id, must all match the current values at verification time — any drift fails the replay test by name, no advisory tier.

## Context

BUILD_PLAN 5.4, closing the gap `docs/CONVENTIONS.md`:189 and `docs/REVIEW-PATTERNS.md`'s two pre-seeded patterns named since 5.3a: a persona's synthetic schema-shaped tests can't catch a prompt↔schema mismatch, only a recorded replay of the real prompt can. Greenfield — no prior recording script, fixture format, or cassette tooling existed anywhere in this repo's history.

## Decisions

1. **Recording and verification are two different programs.** A script that both records live and verifies deterministically would need network access gated inside the CI test path. Recording is manual, deliberate, reviewed; verification is automatic and mechanical, safe with zero network access on every PR.

2. **Fixtures are committed JSON**, one file per `(personaId, scenarioId)`, at `packages/agents/src/personas/<id>/replay/fixtures/<scenario-id>.json`. Rejected: an external store (S3, a DB table) — CI has no live credentials to fetch from one, and a reviewable PR diff (the recorded transcript changing alongside the prompt edit that caused it) is a real feature, not incidental.

3. **Staleness is a whole-content SHA-256 hash of `prompt.md`, a hash of the scenario's own `input`, and an equality check on the resolved model id** — not a semantic diff of any of the three. Any byte change to `prompt.md` invalidates every fixture for that persona (PR #91's one-line wording fix that changed real behavior is why: no reliable line exists between "cosmetic" and "behavioral" to draw automatically). The model-id check exists because `resolvePersonaModel`'s output is a non-pinned alias, not a dated snapshot — a recording taken under one resolved model can silently stop representing what production calls once that resolves differently.

4. **The recording script wraps the real Anthropic client to capture `stop_reason` and raw `usage.output_tokens`**, rather than adding those fields to the three cascade functions' own return types. `stop_reason` is absent from all three on every branch; `output_tokens` is present on `ok:true` but absent on `ok:false` — precisely the branch BUILD_PLAN 5.3a-ii's `MAX_TOKENS`-truncation incident hit (three independent review passes misdiagnosed it as JSON-escaping). A thin recording-only wrapper reads the raw message alongside the existing production call — no production return-type change.

5. **A fixture is an envelope around the cascade function's actual `Result` value**, not the bare Result itself — none of the diagnostic/staleness fields exist on any of the three Result types. This is true only at record time; once written to JSON, `replay-fixture.ts` validates `result` against a hand-maintained Zod mirror of the three Result shapes (Zod schemas can't be derived from a hand-written type, only the reverse), kept in sync manually with the real cascade functions.

6. **Scenario definitions are real TypeScript** (`packages/agents/src/personas/<id>/replay/scenarios.ts`, part of the normal `tsc` build), each naming a `callSite`, an input, and pure assertion predicates over the fixture. Rejected: a declarative (JSON/YAML) format — assertions need real predicates ("the tool-use list contains `report_status`"), and this codebase has no rule-engine/DSL to interpret a declarative condition safely. The recording script (bare-`node`-run, only reaches compiled `dist/` output per `docs/DEVELOPMENT.md`'s Node-native-TS-execution constraint) imports cascade functions from `../dist/index.js` and each persona's scenarios via an explicit static map of `../dist/personas/<id>/replay/scenarios.js` imports — `persona-replay.test.ts` imports `scenarios.ts` straight from `src/` since vitest transpiles directly.

7. **Mechanical checks and scenario-authored assertions are equally CI-blocking** — no advisory tier. What differs is catching power, not enforcement: a hash either matches or it doesn't; a scenario's assertions are a best-effort net a string/regex predicate can't make a full semantic judge. This harness doesn't replace the live-judgment review a `prompt.md` PR already gets (spec-grill, da-review, Alex's own read) — it adds durability, forcing a fresh recording through any `prompt.md`/scenario-input edit rather than silently passing a stale fixture.

8. **A recording that comes back `result.ok === false` or truncated is refused, not written** — stderr detail, non-zero exit. A committed failing/truncated fixture would fail CI forever, since verification never re-calls the network.

9. **Backfill scope: 7–8 scenarios per persona** (5–6 `dmReply` covering that persona's load-bearing behavioral commitments, plus one `ticketDraft` and one `confirmingQuestion` for structured-output schema-drift coverage) — not a replay of every historical adversarial round. Deliberately supersedes BUILD_PLAN 5.4's literal "backfill the first persona" wording: Sarah, Maya, and Marcus all shipped real prompts with zero replay coverage by the time this chunk was picked up, so all three were backfilled in the same chunk (21 scenarios total, live-recorded).

10. **The recording script uses a longer request timeout than production** (`createAnthropicClient`'s 20s default is tuned for a live Slack reply). An optional `timeoutMs` override defaults to the unchanged 20s for every production call site; the recording script passes 120s — confirmed necessary by an actual live timeout while recording, not assumed.

## Deferred / explicitly rejected

- Automated re-recording on every `prompt.md` PR (a CI job with a live API key) — would let a prompt edit "pass" without a human/agent ever reading the new transcript, defeating the point.
- Semantic/LLM-graded assertions — would make verification non-deterministic and network-dependent.
- Coverage for the 5 personas without a `prompt.md` yet — nothing to record against; each future 5.3 sub-chunk adds its own scenarios.
- A separate reviewer-facing "re-record after editing prompt.md" checklist step — the staleness gate is enforced the same way every other required check is (CI must pass before merge).

## Triggers for re-evaluation

- A persona's real `prompt.md` PR ships without a fixture re-recording landing in the same PR — if the hash gate doesn't catch this in practice, the gate design is wrong, not just under-used.
- A recorded fixture's assertions pass while a human reviewer independently judges the transcript as a real regression — evidence the assertion set needs strengthening.
- CI ever needs live-API access for any reason — reopens decision 1.

## References

- `BUILD_PLAN.md` chunk 5.4; [PR #93](https://github.com/Pushedskydiver/moe/pull/93)
- `docs/CONVENTIONS.md` §Testing Standards ("Persona-replay tests are load-bearing, not optional")
- `docs/REVIEW-PATTERNS.md` — "Persona-prompt drift", "Recorded-transcript drift"
- BUILD_PLAN 5.3a-ii's `MAX_TOKENS` misdiagnosis (`stop_reason`/`output_tokens` capture rationale)
