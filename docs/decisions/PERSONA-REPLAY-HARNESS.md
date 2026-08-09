---
status: Draft
date: 2026-08-09
---

# Persona-Replay Test Harness

## Decision

Build record/replay as two separate mechanisms, not one: a **manual recording script**
(`packages/agents/scripts/record-persona-replay.ts`) that hits the real Anthropic API once per
scenario and writes a committed JSON fixture per `(persona, scenario)`, and a fully-mocked,
network-free **replay verification test** (`packages/agents/src/personas/<id>/replay/persona-replay.test.ts`,
one per persona, part of `pnpm test`) that checks the fixture is still valid — not that it still
matches some independent expectation. Validity has five parts, all CI-blocking with equal force
(none is advisory): the fixture's stored `promptContentHash` and `scenarioInputHash` still equal
the hash of the persona's _current_ `prompt.md` and the scenario's _current_ input, and its stored
`model` still equals `resolvePersonaModel(personaId)`'s _current_ output (staleness gate — any of
the three drifting invalidates the fixture, no fuzzy "was this material" judgment), the recorded
call didn't truncate (`stopReason !== 'max_tokens'`), the recording actually succeeded (`result.ok
=== true`), and the recorded output satisfies the scenario's own assertions (a small set of pure
predicates over the real model's real response, written by whoever reviews the recording). CI has
no `ANTHROPIC_API_KEY` and no live-network job exists — fixtures must be committed, and replay
verification must never call the network, or CI can't run it at all.

## Context

BUILD_PLAN 5.4: "Record/replay infrastructure for persona prompts... build it after the first
persona proves the prompt shape... backfill the first persona's recording as part of this chunk."
`docs/CONVENTIONS.md` §Testing Standards already states the reason this exists: "A persona's
synthetic unit tests shaped to a schema can't catch a prompt↔schema mismatch — only recorded
replays of the real prompt can." Three personas (Sarah, Maya, Marcus) now have real `prompt.md`
files and zero persisted replay coverage — every prior validation round (Sarah's nine adversarial
rounds, Maya's seven scenarios, Marcus's ten) was a one-off live-API session, judged in the
moment, never saved. `docs/REVIEW-PATTERNS.md` pre-seeds two patterns this harness exists to
close: "Persona-prompt drift" (a prompt edit ships with no replay re-recording) and
"Recorded-transcript drift" (a stale fixture keeps "passing" after the prompt it was recorded
against no longer exists).

Confirmed via a full repo survey before designing: no prior recording script, fixture format, or
cassette-style tooling exists anywhere in this repo's history (`git log --all` for any
harness/replay path returns nothing, ever committed or deleted). This is greenfield.

## Decisions

1. **Recording and verification are two different programs, not one "replay runner."** A script
   that both records live and verifies deterministically would need network access gated behind
   an env check inside the CI test path — fragile, and it blurs the one property that matters:
   verification must be safe to run with zero network access, every time, on every PR. Recording
   is manual, deliberate, and reviewed; verification is automatic and mechanical.

2. **Fixtures are committed JSON, one file per `(personaId, scenarioId)`**, at
   `packages/agents/src/personas/<id>/replay/fixtures/<scenario-id>.json`. Rejected: an external
   store (S3, a DB table) — CI has no live credentials to fetch from one, and a reviewable PR diff
   is a real feature here (a reviewer sees the recorded transcript change in the same diff as the
   prompt edit that caused it), not incidental to committing to git.

3. **Staleness is a whole-content SHA-256 hash of `prompt.md`, plus a SHA-256 hash of the
   scenario's own `input` (both stored on the fixture, both checked), not a semantic diff of
   either.** Any byte change to `prompt.md` — including ones a human might call "just a typo" —
   invalidates every fixture for that persona; any edit to an existing scenario's `input` (as
   opposed to adding a new scenario) invalidates that one fixture. Rejected: hashing only a
   "meaningful" subset of the prompt, or diffing for material changes — this project has already
   shipped a one-line wording fix that changed real behavior (PR #91, Maya's banter-honesty fix),
   so there is no reliable line between "cosmetic" and "behavioral" to draw automatically. The
   scenario-input hash closes the same drift class from the other direction: without it, silently
   editing a scenario's `input` in `scenarios.ts` would leave a fixture recorded against the _old_
   input passing forever, since nothing else re-derives what input a fixture should correspond to.
   A third staleness axis covers model identity: the fixture's stored `model` (decision 5) must
   equal a fresh `resolvePersonaModel(personaId)` call at verification time — `DEFAULT_MODEL` and
   any future per-persona override (BUILD_PLAN 6.2 already flags Riley's planned Opus-tier
   override) are both non-pinned aliases, not dated snapshots, so a recording taken under one
   resolved model can silently stop representing what production actually calls once that
   resolution changes, with nothing else in this design able to detect it. All three mismatches
   fail the replay test with a message naming the re-record command; none fails the build silently
   or warn-only, matching `docs/CONVENTIONS.md`:189's "not optional" framing.

4. **The recording script wraps the real Anthropic client to capture `stop_reason` and the raw
   `usage.output_tokens` directly from the raw SDK response**, rather than adding those fields to
   `generateReply`/`composeTicketDraft`/`composeConfirmingQuestionLeadIn`'s own return types.
   `stop_reason` is absent from all three functions' return types today, on every branch.
   `usage.outputTokens` is already present on each function's `ok: true` branch — but absent
   entirely from every `ok: false` branch, none of which carries a `usage` field at all. That
   `ok: false` gap is precisely the branch BUILD_PLAN 5.3a-ii's incident hit (truncation →
   `parsed_output === null` → `ok: false, kind: 'no-parsed-output'`, zero usage visibility, three
   independent review passes misdiagnosing it as JSON-escaping instead of `MAX_TOKENS`
   truncation) — so the wrapper's job is specifically to make these two fields available on the
   failure path where production's own types don't carry them, not to duplicate what already
   exists on success. A thin recording-only wrapper around the client (same `{ messages: { create,
parse } }` DI seam every test in this repo already mocks) reads the raw message alongside the
   existing production call — no production return-type change, no risk to the three cascade
   functions' existing consumers or tests.

5. **A fixture is an envelope around the cascade function's actual `Result` value, not the bare
   Result itself** — none of the fields the other decisions need to check against it (decision 3's
   three staleness hashes/model-id, decision 4's `stopReason`/raw output-token count, plus
   `callSite` to know which Result variant applies and `scenarioId`/`recordedAt` for traceability)
   exist on any of the three Result types, so they can't be "the Result verbatim." Concretely:

   ```ts
   interface ReplayFixture {
     readonly scenarioId: string;
     readonly personaId: PersonaId;
     readonly callSite: 'dmReply' | 'ticketDraft' | 'confirmingQuestion';
     readonly promptContentHash: string; // sha256 of prompt.md content at record time
     readonly scenarioInputHash: string; // sha256 of JSON.stringify(scenario.input) at record time
     readonly model: string; // resolved model id (resolvePersonaModel output)
     readonly recordedAt: string; // ISO 8601, stamped by the recording script
     readonly stopReason: string | null; // raw SDK stop_reason — present regardless of ok/error
     readonly outputTokensRaw: number | null; // raw SDK usage.output_tokens — present regardless of ok/error
     readonly result:
       | GenerateReplyResult
       | ComposeTicketDraftResult
       | ComposeConfirmingQuestionLeadInResult;
   }
   ```

   **This is the shape at the moment `record-persona-replay.ts` first records it** — `result` there
   genuinely is whatever `generateReply`/`composeTicketDraft`/`composeConfirmingQuestionLeadIn`
   returned, unmodified. Once written to JSON and read back, though, `packages/agents/src/
persona-replay/replay-fixture.ts` validates `result` against a **hand-maintained Zod mirror** of
   those three Result shapes, not the imported TS types themselves — Zod schemas can't be derived
   from a hand-written type, only the reverse, and a fixture is JSON, a different boundary from the
   in-memory value a live caller receives (`docs/CONVENTIONS.md` §Zod). So "not a hand-rolled
   parallel shape" is true only at record time; the _loaded/verified_ type is exactly that — a
   separate, manually-kept-in-sync mirror — and `replay-fixture.ts`'s own code comment says so
   directly. What doesn't change between the two: the mirror is checked field-for-field against the
   real three files (including the exact `error.kind` literal union), so a loaded fixture still
   faithfully represents what a live caller would have received, even though the TypeScript type
   doing the representing is a different, parallel one after the JSON round-trip. The envelope
   around `result` exists because the diagnostic and staleness data is a
   different concern from the call's own outcome.

6. **Scenario definitions are real TypeScript**
   (`packages/agents/src/personas/<id>/replay/scenarios.ts`, part of the normal `tsc` build), each
   scenario naming a `callSite` (`dmReply` | `ticketDraft` | `confirmingQuestion`), an input, and a
   small array of pure assertion predicates over the fixture. `tsconfig.json`'s `include: ["src"]`
   (inherited by `tsconfig.build.json` via `extends`, which adds no `include` of its own) picks
   these up automatically, so `tsc` now produces real output under `dist/personas/`
   for the first time (previously that directory held only `.md` files, added exclusively by the
   whole-tree `cp -r` step below). **This required an actual build-script fix, caught live, not
   just a documentation note as first assumed:** `cp -r SRC DEST` nests `SRC` _inside_ `DEST` when
   `DEST` already exists (standard `cp` semantics) rather than merging into it — once `tsc` created
   `dist/personas/` on its own, the old `cp -r src/personas dist/personas` step started copying
   into `dist/personas/personas/...` instead, silently breaking every persona's `prompt.md` path in
   the built package. `packages/agents/package.json`'s `build` script now reads `mkdir -p
dist/personas && cp -r src/personas/. dist/personas/` — the trailing `/.` on the source copies
   _contents_ into an existing destination rather than the directory itself, verified empirically
   (a scratch `cp` reproduction, then the real `dist-build-verification.test.ts` regression test)
   before and after the fix. The redundant raw `.ts`/`.test.ts` copy that lands in
   `dist/personas/<id>/replay/` alongside the compiled output is genuinely harmless — confirmed,
   not just asserted this time. Rejected: a
   declarative-only (JSON/YAML) scenario format — assertions need to express real predicates ("the
   response mentions X", "the tool-use list contains `report_status`"), and this codebase has no
   existing rule-engine/DSL to interpret a declarative condition safely; a plain TS predicate is
   the smallest thing that works and matches every other pure-function convention in this repo.

   **Two different consumers, two different import rules — both need stating explicitly, per
   `docs/DEVELOPMENT.md`'s "Node-native TS execution and local imports" constraint.**
   `persona-replay.test.ts` runs under vitest, which transpiles `.ts` directly via esbuild, so it
   imports `./scenarios.js` straight from `src/` like every other test in this repo. The recording
   script runs via bare `node` (`pnpm build && node scripts/record-persona-replay.ts`, mirroring
   `packages/core/scripts/migrate.ts`'s own `pnpm build && node scripts/migrate.ts` precedent) —
   Node's native TS type-stripping does not remap `.js` specifiers onto sibling `.ts` files, so it
   can only reach compiled `dist/` output. It imports the three cascade functions and
   `createAnthropicClient`/`fetchPersonaPromptContent`/`resolvePersonaModel` from `../dist/index.js`
   (the package's public barrel), and each persona's scenarios via a small static map of explicit
   `../dist/personas/<id>/replay/scenarios.js` imports (one entry per backfilled persona, not a
   dynamic string-built import) — matching this repo's preference for explicit code over cleverness
   at this scale (3 personas today). It reuses `createAnthropicClient` (already redaction-wired per
   `docs/CONVENTIONS.md` §External API Integration Patterns) rather than hand-rolling a fresh
   client, and is exposed as `packages/agents/package.json`'s `"record:replay"` script — `pnpm
--filter @moe/agents record:replay -- <personaId>`, mirroring the `pnpm build && node
scripts/<name>.ts` shape of every existing script in this repo (`migrate`, `backup`,
   `sweep:review-queue`, …).

7. **Mechanical checks (hash matches, no truncation, `result.ok === true`) and scenario-authored
   assertions are equally CI-blocking** — there is no advisory tier. What differs between them is
   _catching power_, not enforcement: the mechanical checks are exhaustive within what they check
   (a hash either matches or it doesn't), while a scenario's assertions are a best-effort net
   written by whoever reviews that recording — a string/regex predicate cannot, in general, fully
   verify "this is still in Sarah's voice." This harness does not claim to replace the live-
   judgment review a `prompt.md` PR already gets (spec-grill, da-review, Alex's own read of the
   transcript); what it adds is durability — the same judgment, once made and encoded as an
   assertion, keeps being checked on every future _unrelated_ change, and any `prompt.md` or
   scenario-input edit is _structurally_ forced back through a fresh recording (decision 3) rather
   than silently passing a stale fixture.

8. **If a recording comes back `result.ok === false` or truncated (`stop_reason === 'max_tokens'`),
   the recording script refuses to write the fixture** — it prints the raw failure/truncation
   detail to stderr and exits non-zero, rather than committing a fixture that would then fail CI
   forever (replay verification never re-calls the network, so a committed failing fixture can't
   self-heal). A failure is a signal to fix the scenario, the persona prompt, or a `MAX_TOKENS`
   ceiling before recording again — never a state this harness treats as a legitimate, permanently
   red fixture.

9. **Backfill scope is 7–8 scenarios per persona, not a replay of every historical adversarial
   round: 5–6 `dmReply` scenarios covering that persona's load-bearing, already-shipped behavioral
   commitments, plus exactly one `ticketDraft` and one `confirmingQuestion` scenario each** for
   schema-drift coverage on the structured-output paths. Concretely — Sarah: evidence-before-
   verdict, ambiguity-escalation, equal-treatment/no-deference banter (`dmReply` ×3+) + 2
   structured; Maya: the PR #91 banter-honesty regression recorded as a permanent fixture guarding
   that exact bug, grounded/intentional-vs-comfortable design judgment (`dmReply` ×2+) + 2
   structured; Marcus: Rule-of-Three threshold, self-review-anchoring, `report_status` routing
   (`dmReply` ×3+) + 2 structured — each list non-exhaustive up to its persona's own 5–6 floor.
   Historical round counts (Sarah 9, Maya 7, Marcus 10) were exploratory drafting sessions, not a
   target replay-suite size. **This deliberately supersedes BUILD_PLAN 5.4's literal "backfill the
   first persona's recording" wording** — Sarah, Maya, and Marcus all now ship real prompts with
   zero replay coverage (`BUILD_PLAN.md:276` already flags this chunk as two personas overdue
   against its own "from the second persona on" commitment, and `PROGRESS.md`'s Session 32 loading
   instructions direct backfilling all three in this chunk) — BUILD_PLAN 5.4's own checklist text
   should be corrected to name all three personas once this chunk lands.

10. **The recording script uses a longer request timeout than every production call site, via an
    explicit override, not a global increase.** `createAnthropicClient`'s existing 20s default
    (`packages/agents/src/create-anthropic-client.ts`) is tuned for a live Slack reply's latency
    target — a batch recording script has no such constraint, and live-recording the redesigned
    `calibrated-ambiguity-names-and-proceeds` scenario (BUILD_PLAN 5.4's Marcus backfill) genuinely
    timed out at 20s, confirmed by actually running the script, not assumed. `createAnthropicClient`
    gained an optional third `timeoutMs` parameter defaulting to the unchanged 20s constant; every
    production call site's behavior is untouched, and `record-persona-replay.ts` is the one caller
    passing 120s. Rejected: raising the shared default for every caller — the value is tuned for a
    different task shape (live vs. batch), not a repo-wide constant that happened to be too small.

## Deferred / explicitly rejected

- **Automated re-recording on every `prompt.md` PR (a CI job with a live API key).** Rejected for
  now: it would let a prompt edit "pass" without a human/agent ever reading the new transcript,
  defeating the actual point (`docs/REVIEW-PATTERNS.md`'s pattern is about _unreviewed_ drift, not
  merely _unrecorded_ drift). Revisit if the review-gate process itself starts skipping the
  re-record step in practice.
- **Semantic/LLM-graded assertions** (an LLM judging whether a replayed response is "in voice").
  Out of scope — would make verification itself non-deterministic and network-dependent, the exact
  property decision 1 exists to avoid.
- **Coverage for the 5 personas without a `prompt.md` yet.** Nothing to record against; each future
  5.3 sub-chunk adds its own scenarios once its prompt exists, per BUILD_PLAN 5.4's own "used by
  every 5.3 sub-chunk from the second persona on."
- **A separate reviewer-facing reminder/checklist step for "re-record after editing `prompt.md`".**
  Deliberately not added beyond `docs/REVIEW-PATTERNS.md`'s existing pattern entries — the staleness
  gate (decision 3) is enforced the same way every other required check is (`docs/GIT.md`: CI must
  pass before merging main's branch protection), so a missed re-record fails the PR mechanically
  rather than depending on a human remembering a checklist item.

## Triggers for re-evaluation

- A persona's real `prompt.md` PR ships without a fixture re-recording landing in the same PR
  (the exact failure mode `docs/REVIEW-PATTERNS.md` names) — if the hash gate doesn't actually
  catch this in practice, the gate design is wrong, not just under-used.
- A recorded fixture's assertions pass while a human reviewer independently judges the transcript
  as a real regression — evidence the assertion set for that scenario needs strengthening.
- CI ever needs live-API access for any reason — would reopen decision 1.

## References

- `BUILD_PLAN.md` chunk 5.4
- `docs/CONVENTIONS.md` §Testing Standards ("Persona-replay tests are load-bearing, not optional")
- `docs/REVIEW-PATTERNS.md` — "Persona-prompt drift", "Recorded-transcript drift"
- `PROGRESS.md` Session 32 loading instructions (top-level "Primary workstream" bullet — not one of
  the lettered decision branches; branch KK there is the unrelated `docs/PERSONAS.md`
  roster-staleness lesson)
- BUILD_PLAN 5.3a-ii's `MAX_TOKENS` misdiagnosis (`stop_reason`/`output_tokens` capture rationale)
