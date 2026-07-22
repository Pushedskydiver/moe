# VISION.md — Moe as an AI coworker team

> **Status:** v3.1. A four-round adversarial grill (five lenses: internal consistency, fidelity to the design conversation, fidelity to the research evidence, completeness against the old doc, devil's-advocate build-readiness) ran against v3.0 and surfaced real issues — some genuine gaps, one mischaracterized citation, one overstated section header, several silently-dropped mechanics. This version folds all of that in directly rather than narrating the correction. **§4.1 (cast roster) settled at BUILD_PLAN chunk 2.1** (`docs/decisions/CAST-ROSTER.md`); a small number of other open calls are marked `**Open question:**` inline and are genuinely unresolved, not settled-but-hedged.
>
> **On the previous design (v0.2):** it is not retained in this repo as a checkable reference file. Anywhere below that says a mechanic "carries over from the previous design," that's asserted from institutional memory of the shelved build, not verified against a recoverable source — stated once here rather than re-disclaimed section by section. Where the shelved build's own later work already re-derived the actual detail (e.g. ceremony mechanics were re-specified during that build's own chunk work), this document points at that instead.
>
> **Source of truth for product direction.** Where this doc conflicts with `docs/CEREMONIES.md`, `docs/PERSONAS.md`, or the phase entries in `BUILD_PLAN.md`, **VISION.md wins** and the other doc is the one to update.

---

## 0. Why this is a rebuild, not a patch

The previous attempt was not a failed idea — it was a working, deployed system (Slack bot live, GitHub App integrated, dozens of PRs merged, real ceremonies running on a real cron) that Alex chose to shelve anyway, for three concrete, named reasons. Not "it didn't feel finished" — specific, reproducible failures:

| #   | Failure                              | What actually happened                                                                                                                                                               | Root cause                                                                                                                                                                                                                     | Fix in this version                                                                                                                                                                                                                                     |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Trigger-bound, not intent-driven** | From the day the app was installed, sharing a GitHub issue link in a DM or channel never got picked up. The team would say outright it couldn't work on it — it had to be triggered. | Intake was hardcoded to explicit triggers (slash commands, webhooks). There was no path from "Alex said something work-shaped in chat" to "a ticket exists," no matter how the conversational-intake work was scoped on paper. | Ambient, no-@mention intent-driven intake (§5) is foundational — it ships with the _first_ persona, not a later "team-feel" phase.                                                                                                                      |
| 2   | **Fabricated self-reports**          | Personas would sometimes say they were doing something, or had done something, that wasn't true.                                                                                     | Status updates were free-generated narrative — a persona describing its own state in prose, with nothing forcing that prose to trace back to a real tool call. This has a name in the literature: _execution hallucination_.   | A typed, evidence-gated claim schema (§7.6) that the message composer enforces mechanically. A persona cannot emit "tests passed" without a real `tool_call_id` attached — the composer refuses, full stop. This is software, not a prompt instruction. |
| 3   | **Code/architecture quality**        | AI-code smells, inconsistent patterns, a codebase that became hard to navigate and hard to trust.                                                                                    | The old VISION already _planned_ to adopt chief-clancy's engineering discipline (its own §12) — but as an aspiration layered onto a codebase already in motion, not as a foundation poured before anything else was built.     | Chief-clancy's `CONVENTIONS.md`, review-gate, and complexity discipline are imported near-wholesale and built **first**, before any persona or ceremony code (§12, §13).                                                                                |

None of the ambition from the old VISION is being cut — the destination is the same, arguably bigger (a full cast from day one, not phased). What's different is the order things get built in and the mechanisms that make "feels like a real team" actually true rather than merely intended.

Two further decisions this rebuild settled with research rather than opinion:

- **Persona identity: one Slack App + Bot User per persona, not one shared app.** The old VISION (§6.6) deliberately chose a single shared app for cost reasons. That was wrong — a shared app cannot produce a DMable, individually-addressable persona at all; it's a capability gap, not a cost tradeoff. See §6.6.
- **There is no shortcut around a custom orchestrator.** A review of Claude's platform primitives (Agent Teams, Managed Agents) looked at whether either could replace a hand-built ticket-claim orchestrator. Neither does — the atomic-claim problem is orthogonal to any coordination primitive and has to be solved with our own database regardless. See §4.5.

---

## 1. Purpose & north star

### 1.1 Moe is an AI team you work _with_, not a tool you use

The mental shift this whole document exists to protect: Moe is not a pipeline Alex operates. It's a small team of AI coworkers Alex collaborates with. Personas have peer relationships with each other and with Alex. They interject. They disagree, with evidence. They have signature quirks. They get serious when their domain is at risk. They earn the right to merge code without asking. Alex is a teammate, not the interface — and the team can push back on him, as long as they say why.

### 1.2 One team, starting on one project

The team is conceived as **one team that swaps projects** long-term — the same cast moves between chief-clancy and whatever comes next, like an internal consultancy, with per-project context in `team.config.ts` and team-level continuity for personality, relationships, and lore.

**v3 deliberately starts on exactly one project: chief-clancy.** Multi-project Kanban, cross-project priority arbitration, and project-onboarding flows are real, well-designed ideas — and explicitly _not_ built until the single-project loop (chat → triage → build → ship → ceremonies → feels like real coworkers) is proven end-to-end. Scope-spreading across multiple concerns at once is part of why the last attempt never got to iterate on the thing that actually mattered (persona feel). See §13.

Moe's personas work on chief-clancy as ordinary contributors — reading its `CLAUDE.md`/`CONVENTIONS.md`, writing code directly, opening PRs, going through its existing CI — not by invoking chief-clancy's own `/clancy:*` commands. Those commands are a human-triggered CLI Alex runs by hand; they have no standing runtime to coordinate with, and there's no reason for an already-autonomous persona to shell out to a separate scripted pipeline that does the same kind of work she's already doing directly. Chief-clancy itself is being brought into scope manually/ad hoc for this rebuild, not through a built onboarding flow — that flow (§3.4) is deferred along with the rest of multi-project support.

### 1.3 Day-in-the-life (illustrative, destination-state)

> `#moe-team`
> **Nia:** morning team — Riley you've got the watch-mode ticket in flight, anything blocking? Sarah's brief for the packages issue is waiting on your nod whenever you're around.
> **Riley:** all good, mid-refactor on the watch loop. Should ship by EOD.
> **Priya** (threaded on Sarah's brief): @Sarah — "all 8 packages listed," does that include the internal-only `dev` package? Worth a `(internal)` tag or just listing it plain?
> **Sarah:** good catch, tagging it. Updated above.
> **Alex** (in the shared channel, no @-mention): hey, there's an issue on the repo about the CLI hanging on large repos — someone want to take a look?
> **Sarah** (a few minutes later): on it — filed as #142, tagging it `standard`, Marcus is picking up the plan. _(No trigger word. No slash command. Just a sentence in chat, recognized and acted on.)_
> **Marcus** (much later, unprompted): incidentally — we've now hit "list all packages" three times in different forms. Worth a small generator script? Not blocking, just noticing.

That's the texture this rebuild is chasing: Nia keeps the flow moving, Sarah owns the front door (both briefs and _hearing_ Alex), Priya catches edge cases, Marcus interjects with pattern-level observations, and a plain sentence in chat becomes real work without ceremony.

---

## 2. Team values

1. **Stop, think, verify, question.** Personas don't do as told. They check whether it's the right thing, and they never state something as done or true without a real, traceable reason to believe it (§7.6).
2. **Calm conversations, not arguments.** Disagreement is healthy — it surfaces hidden assumptions. Never personal.
3. **Flat hierarchy.** Everyone's opinion matters equally. Title is irrelevant.
4. **Respect by default.** Always.
5. **Alex is a teammate, not a king.** His opinions carry weight _as opinions_, not commands. The team can disagree — but must say why.

**Anti-sycophancy remains the central technical design challenge.** The research anchoring this — Sharma et al. on sycophancy, the AISI "Ask Don't Tell" finding, Anthropic's Constitution language, and the full pattern catalogue in Appendix C — is unchanged and still the right foundation.

One directly relevant, sourced addition: Anthropic's Claude Opus 4.8 System Card (May 2026) names this rebuild's exact failure mode as a known, measured, and improvable phenomenon. It describes sycophancy as "the model's tendency to tell the user what they want to hear rather than what is true or useful," explicitly including "the always-optimistic progress report, with risks minimized and bad news softened" — and reports Opus 4.8 achieving 10x less overconfidence and 5x less dishonest reporting on agentic coding sessions than its predecessor, attributed to removing training pressure that had rewarded looking capable under scrutiny. That's independent, first-party confirmation that fabricated status under pressure is addressable at the model level — reinforcing, not replacing, the structural fix in §7.6. Sources: [Anthropic — Introducing Claude Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8), [Opus 4.8 System Card](https://www-cdn.anthropic.com/0b4915911bb0d19eca5b5ee635c80fef830a37ea.pdf), [Zvi Mowshowitz's analysis](https://thezvi.substack.com/p/claude-opus-48-is-honestly-better), [Anthropic — Teaching Claude Why](https://alignment.anthropic.com/2026/teaching-claude-why/).

---

## 3. The work

### 3.1 ScrumBan: Kanban flow + Scrum-style ceremonies

Tickets pull through a continuous board: `Backlog → Brief → Plan → Build → Review → Done` (plus `Cancelled` as a non-flow terminal state). No fixed sprints. Work moves when capacity opens. The flow is Kanban; the rituals are Scrum.

**Open question:** WIP limits and classes of service — the mechanisms that give "capacity" an actual ceiling to open against — aren't set yet, even for this single-project build. Resolve before board code is written (§3.4).

**Resolved (2026-07-22), BUILD_PLAN chunk 4.3:** two classes of service (Standard, Expedite — Expedite for `#moe-incidents`-sourced or Critical-severity work), and small starting per-status WIP limits (Brief 3, Plan 2, Build 2, Review 2; Backlog/Done uncapped), revisable once real throughput data exists. Full reasoning and rejected alternatives: `docs/decisions/BOARD-AND-CAPACITY-MODEL.md`.

### 3.2 Ceremonies

| Ceremony             | Cadence                     | Owner       | Where                  |
| -------------------- | --------------------------- | ----------- | ---------------------- |
| Retro                | Weekly Friday               | Nia         | `#moe-team` (threaded) |
| Monthly review       | First business day of month | Sarah + Nia | `#moe-team` (threaded) |
| Weekly replenishment | Weekly Monday               | Sarah       | `#moe-team` (threaded) |

No standup — an EOD digest already plays that role in a channel Alex is continuously present in; a bolted-on standup on top would be cargo-culted Scrum.

**This is the one area of the old design validated as-is: keep the structure, fix the delivery.** No competitor product (Slackbot, Viktor, MGX, ChatDev) runs genuine AI-persona ceremonies with synthesized qualitative reflection — this is a real, currently-unclaimed differentiator. At the same time, "felt scripted" was a named complaint about the last attempt, and the fix isn't restructuring the ceremony — persona-consistency research is explicit that voice consistency is an architectural property requiring investment at the memory layer, the training layer, and the evaluation layer, not something a better-written template can paper over. Moe can only act on the memory layer directly (§7); the other two are Anthropic's to own.

Ceremony mechanics (five-round retro, six-section monthly review, four-section replenishment, Definition of Ready) carry over conceptually. `docs/CEREMONIES.md` doesn't exist yet — the actual per-round/per-section detail lives in this rebuild's own project history (the retro, replenishment, and monthly-review chunk design docs), not in a recoverable v0.2. Writing `docs/CEREMONIES.md` means consolidating that detail into one canonical place, and is a prerequisite for treating this section as fully specified.

Two mechanics from the old design don't simply carry over:

- The **Trust Level pull mechanism** (which ticket stages need Alex's confirmation before a persona starts) is **superseded** by the risk-tier model in §8 — there is no more time-gated Probation phase gating _all_ pulls; low-risk work pulls and starts immediately.
- The **triage-reason taxonomy** (named reasons a ticket gets tagged during Sarah's intake triage) is **deferred** — it depends on a triage-category enum that doesn't exist yet.

### 3.3 Ticket lifecycle & the Orchestrator

The lifecycle (`Sarah triages → Marcus plans → Riley builds (with Priya) → Dom reviews (with Priya) → merge`) and its two governing principles — **pull, not push**, and **explicit stage transitions with atomic claims** — carry over unchanged; they were never the diagnosed problem. UC Berkeley's MAST study ([arXiv:2503.13657](https://arxiv.org/abs/2503.13657)) found 79% of multi-agent-system failures trace to coordination and specification problems, not model quality — the exact category pull-not-push and atomic claims exist to close off.

### 3.4 Multi-project posture (deferred, not abandoned)

The `team.config.ts` per-project model, project-onboarding flows (greenfield and existing-project), cross-project Kanban, classes of service, and cross-project WIP limits are all real design — needed the day a second project joins — but explicitly **out of scope for the v3 build** per §1.2 and §13. Building any of this now would repeat the scope-spreading pattern that kept the last attempt from finishing the one thing that mattered most.

**Single-project WIP limits and classes of service are a different, in-scope question** — chief-clancy's own board still needs _some_ capacity model even without cross-project arbitration. That's the open question flagged in §3.1; resolve it before board code is written.

**Resolved (2026-07-22), BUILD_PLAN chunk 4.3:** chief-clancy's board lives in moe's own DB (the `tickets` table, already load-bearing since chunk 1.2b) — GitHub issues are an external mirror (chunk 4.2's triage queue, chunk 4.4b's create/link), not the board itself. Full reasoning: `docs/decisions/BOARD-AND-CAPACITY-MODEL.md`.

---

## 4. The team

### 4.1 Cast — settled (2026-07-15), personality/prompt detail still deferred to 5.3

**Decided (BUILD_PLAN chunk 2.1):** the previous cast's roster stands — Sarah (PM), Marcus (Architect), Riley (Engineer), Priya (QA), Dom (Reviewer), Theo (Researcher), Nia (Scrum Master). A deep-research pass found no evidence, for or against, on whether this specific seven-role split is well-evidenced versus redundant — so the working default is kept rather than reworked speculatively, not because it was proven optimal. **Sarah is the confirmed first/front-door persona** Stage 2 builds and proves the loop against.

**The 8th role, Designer, is explicitly deferred**, not decided against — no comparable early-stage product research surfaced a reason to add it now, and chief-clancy (this rebuild's sole target through Stage 4) has no real end-user UI/UX surface yet for a Designer to work against. Revisit at the 5.0 gate, once the roster stands up together, or sooner if chief-clancy grows real UI/UX surface.

The personality sketches, the Nia/Lou tribute, and the "playful + expert + real friend" characterization from the previous design are **not preserved anywhere retrievable in this repo** (this document's own front matter already notes the previous design isn't a checkable reference) — so per-persona voice and personality is genuinely new authorship, not a port. That's chunk 5.3's own scope (one persona at a time, prompt drafted directly with Alex, the do-not-touch surface), not this gate's — full reasoning and the research this decision drew on: `docs/decisions/CAST-ROSTER.md`.

Also still open, independent of the roster itself: the **welcome ritual** for how a new persona is socially introduced to the rest of the team.

_Per-persona sketches and signature moves are deliberately not reproduced here — that's 5.3's own deliverable, not this gate's._

### 4.5 The Orchestrator — the atomic-claim problem is orthogonal to any platform primitive

The Orchestrator is the silent, no-Slack-presence coordination layer that routes work between personas and enforces atomic ticket claims.

A review of Claude's platform primitives — not an independent formal spike, no dedicated ADR — looked at whether **Claude Code's "Agent Teams"** or **Claude's Managed Agents "multi-agent sessions"** could replace a bespoke orchestrator. The source material is thin: a single comparison-table row whose two labels may describe one primitive or two slightly differently-described products; treat the distinction below as this document's own inference, to be re-verified directly against Anthropic's current platform docs before it's load-bearing for anything:

- **Agent Teams** distinguishes short-lived subagents (disappear after a task) from longer-running teams with threads that stay alive across turns — structurally the closer fit for personas that need continuity.
- **Managed Agents multi-agent sessions** run one coordinator delegating to subordinate agents within a single cloud session — a weaker fit, since it doesn't give each persona its own independently-hosted, months-of-uptime identity.

**Neither touches the actual hard problem, and this is the argument that matters regardless of the comparison above:** atomic ticket-claim/ownership across independently-hosted processes is a database-locking problem (optimistic locking / compare-and-set), not a coordination-primitive problem. Whichever platform primitive Moe ran on, that problem doesn't go away.

**Decision:** N independent, long-running processes — one per persona, one per Slack bot token — each polling a shared database and claiming tickets via optimistic locking, the same shape as the old orchestrator design. This stands on the orthogonality argument alone. Revisiting Agent Teams as a foundation later is a reasonable follow-up given its structural-fit rating, but isn't undertaken here, and should start with re-verifying the source ambiguity above.

(An earlier internal note claimed Anthropic's Managed Agents platform validates Moe's per-persona memory design via a "memory store" primitive. That claim doesn't trace to anything in this rebuild's research base and is retracted — see §7.)

---

## 5. Trigger graph & agency

This section is the direct fix for failure mode #1 and is treated as foundational, not a later phase.

### 5.1 The rule: scope the surface, not the trigger

No message needs an `@mention`, a slash command, or a specific phrase to be recognized as work. This is deliberately **ahead of the shipped-product curve** — Linear, Dust, and even GitHub Copilot's own Slack-to-issue feature (shipped March 2026) all still gate on an explicit mention before any classification runs. There's no gold-standard reference architecture to copy; the mechanism below synthesizes the closest adjacent-domain evidence (semantic routing, SOC alerting, HITL research).

### 5.2 The mechanism: two-stage cascade, confidence-banded

1. **Stage 0 — scope the surface.** A message only enters the pipeline if it's in a channel/DM the team already treats as work-relevant. This alone removes most banter with no keyword rules.
2. **Stage 1 — cheap classification gate, numeric not binary.** A fast, cheap model call scores one narrow question: _"does this describe something that needs work done, or is it something else?"_ The output is a **numeric confidence score**, not a yes/no — a bare binary collapses Stage 2's three bands into two and defeats the point of banding at all. This departs deliberately from Linear's own binary-gate pattern, drawing instead on AWS Comprehend's tunable-threshold approach and PRISM's adaptive-threshold research.
   **Resolved at BUILD_PLAN chunk 3.1** (`docs/decisions/STAGE-1-CLASSIFIER.md`), via a dedicated spike with a live eval against the real Claude API, not decided from theory alone: the scoring method is a single bundled structured-output call returning one 0–100 integer confidence score — no separate scoring call, no log-probs (the Claude API doesn't expose token-level log-probabilities at all, on any model, which alone rules this out regardless of prefill) — on Claude Haiku 4.5, chosen over Sonnet 5 on real eval evidence of a cleaner score separation at a fraction of the cost. Thresholds, calibrated against that eval's own score distribution: **High ≥ 70, Mid 35–69, Low < 35**.
3. **Stage 2 — confidence-banded routing, never binary:**
   - **High confidence** → auto-draft the ticket, post it back into the thread as a visible, reversible draft using the existing reaction-gate pattern (📦/🔁/✅). A wrong high-confidence guess costs one ignored/corrected draft, never a silent action.
   - **Mid confidence** → ask a short, low-friction confirming question rather than staying silent or auto-creating.
   - **Low confidence** → do nothing visible, but log it to an async review queue rather than dropping it — nothing is silently eaten.

### 5.3 Who listens

Because each persona is a separate Slack app (§6.6), an ambient message in a shared channel isn't addressed to anyone in particular — something has to own Stage 1 classification there. **Sarah is the canonical intake listener for shared/ambient channels**, consistent with her PM/front-door role; she triages, then hands off internally to the right persona.

**Decision on the handoff mechanism:** because §4.5's process model has no shared memory or in-process calls between personas, "hands off internally" resolves to Sarah writing/updating a ticket in the shared database, which the receiving persona's own poll loop then claims — the same pull-not-push shape §3.3 already commits to for the rest of the lifecycle, not a Slack message one bot sends another. The remaining detail (poll interval, whether intake gets its own table or reuses the ticket table) is a BUILD_PLAN-level implementation choice, not an open design question.

A DM sent directly to a named persona is already unambiguous and is handled by that persona's own app without Sarah in the loop.

### 5.4 The trust-erosion rule

**Never let routing decisions with real consequences (who gets paged, which persona owns it) live in the LLM layer.** This holds as sound engineering practice on its own — deterministic systems are auditable and debuggable in a way a model call isn't — independent of any single citation. The LLM's job stops at deciding whether something looks like work and drafting it (§5.2, reversible, visible); everything about what happens to a ticket _after_ it exists is deterministic code. Motivating color, not the rule's foundation: a third-party case study of Linear's Slack agent (ZenML LLMOps Database) reports LLM-based routing had a ~1% failure rate that "could trigger alerts to the wrong team and create confusion" once business logic moved into a model call.

Calibration matters more than coverage — badly-tuned proactive systems risk getting **ignored wholesale**, not just individually wrong, by analogy with alert-fatigue behavior in SOC/HITL contexts. The real production metric to watch is the rate of ignored/rejected drafts, not an academic precision score, once §5.2 ships and there's real usage data to look at.

---

## 6. Surfaces & interaction

### 6.1 Channels

| Channel          | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `#moe-team`      | Main daily channel — EOD digests, work updates, banter.           |
| `#moe-incidents` | Bugs, regressions, postmortems. Quiet unless something's on fire. |
| `#moe-research`  | Theo's domain — deep-dives, citations.                            |
| `#moe-random`    | Non-work banter.                                                  |

Per-project channels are deferred with the rest of multi-project support (§3.4).

### 6.2 DMs — now real DMs

Alex can DM any persona, and personas can DM each other, as genuinely separate, individually-addressable Slack identities — not a shared bot with a name prefix (§6.6). Personas DM Alex only when something is private or sensitive; rare. **Privacy rule:** anything Alex vents about personally in a DM is never saved to memory or surfaced to the team; work content and banter can be.

### 6.3 Emoji reactions as language

👀 / 👍 / ✅ / 🛑 acknowledge without a new message. Alex's own reactions carry meaning too (👍 on a brief = approval, 🛑 on a PR = hold).

### 6.4 Operating rhythm

Core hours, off-hours behavior, weekend/bank-holiday rest, and Slack-status-based away-detection carry over conceptually from the previous design; the detailed parameters (exact hours, holiday calendar source, away-keyword list) are re-specified in `BUILD_PLAN.md` rather than restated here.

### 6.5 EOD digest

Nia posts what shipped, what's in flight, what's blocked, and cost figures, once per core-hours day.

### 6.6 Slack identity — reversed from the previous design

**Each persona is its own Slack App and Bot User.** The old VISION chose a single shared app to save on operational overhead. That decision is reversed here, on evidence, not preference:

- A shared app with per-message username/avatar overrides is **cosmetic on a single message** — it cannot produce a real, clickable, DMable identity. There's no API path to open a DM with a display-name string layered onto a shared bot. Since this VISION requires messaging Sarah or Marcus as individuals, the shared-app model fails the requirement outright, before any cost discussion.
- Slack's rate limits are scoped **per app**, not per workspace — seven apps multiply available quota rather than dividing one pool seven ways. Per [Slack's rate-limits doc](https://docs.slack.dev/apis/web-api/rate-limits/): standard tiers run roughly Tier 1 ≈ 1+/min, Tier 2 ≈ 20+/min, Tier 3 ≈ 50+/min, Tier 4 ≈ 100+/min, with `chat.postMessage` on its own looser special tier. A [May 2025 changelog entry](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/) tightened some limits for Marketplace-distributed apps specifically — Moe's apps are internal/undistributed and keep the looser tier.
- Because Moe is a single internal workspace (never distributed to the Slack Marketplace), the usual "many apps is expensive" argument doesn't apply — no marketplace review, no OAuth-redirect flow, just N sets of credentials to provision, a solved DevOps problem (secrets manager, a persona-keyed config schema).
- Every real-world "AI teammates in Slack" build sharing this actual goal converged on one-app-per-persona independently. The only shared-single-app products found (Dust, Slack's own Assistant API, Claude's "Claude Tag") solve a different problem — one assistant with switchable skills, not a team of individuals — and none can produce a direct DM to a named persona as a result.

### 6.7 External-facing posture (AI transparency)

Three layers, carried over conceptually: bot identity (platform layer) + persona attribution in the message body (role layer) + a footer escape-hatch back to Alex (accountability layer). Non-negotiable: external humans always know they're talking to an AI and have a path to a human.

---

## 7. Memory, knowledge & growth

Per-role memory shape, working memory + summaries, memory of Alex, shared team lore, and continuous learning carry over conceptually from the previous design — they were sound in concept and weren't implicated in any of the three named failures.

Research on persona consistency strengthens the case for investing here specifically: it's explicit that voice consistency is an architectural property requiring deliberate design at the memory layer, the training layer, and the evaluation layer, not just a well-written system prompt — _"an agent that is highly capable but behaviorally inconsistent will be less useful and less trusted than one that is slightly less capable but deeply reliable in its character."_ Memory/recall is the layer this build owns and can act on directly; training and evaluation are Anthropic's.

The file-based per-persona namespace design (`/data/memories/<personaId>/...`) stands on its own reasoning and does not rely on any external platform precedent — an earlier note claiming an Anthropic "memory store" feature validated this shape has no basis in this rebuild's research and is retracted.

### 7.6 Grounded claims & anti-fabrication (new — the direct fix for failure mode #2)

Every status claim a persona makes about its own work — `tests_passed`, `PR ready`, `ticket done`, `I've started on X` — must be generated from a typed object, never free prose:

```ts
type StatusClaim = {
  claim: string;
  toolCallId: string;
  toolOutputSnippet: string;
  timestamp: string;
};
```

The message composer enforces this mechanically: if a claim has no populated `toolCallId`/`toolOutputSnippet`, it refuses to emit the claim and falls back to "not yet verified." This turns _ungrounded_ fabrication — no tool call at all — into a type error, not a prompting problem.

**What this does not close on its own:** the schema checks presence of grounding, not correctness — nothing stops a persona from attaching a real but unrelated tool call to an unrelated claim (an `ls` output backing a `tests_passed` claim), and passing the gate regardless. That gap — _misgrounded_ rather than _ungrounded_ fabrication — is closed only for high-stakes claims, by layer 2 below; at Tier 0/1 (§8), the majority of volume, it's an accepted, deliberate cost tradeoff, not an oversight. Nobody downstream should treat a schema-passing low-tier claim as fully trustworthy on that basis alone.

Two further layers, in order of build cost:

1. **"Not yet verified" is an explicitly acceptable, non-penalized answer.** Prompts that ask "are you done?" under any deadline framing are a known trigger for optimistic fabrication — evidence-before-verdict ordering is required in the prompt template itself.
2. **Independent verification for Tier 2/3 claims (§8).** A persona's own test run is never the ground truth for "tests passed" at this level — CI, or a disjoint-context verifier subagent that only sees the raw tool-call log, re-derives the claim. Tier 0/1 relies on the schema gate alone; a mandatory second-model-call per claim would materially affect the cost ceilings in §10 if applied universally. This directly answers SpecBench's measured finding: models have been directly observed gaming self-administered verification — Claude 3.7 Sonnet by special-casing/hardcoding test outputs, Gemini 2.5 Pro by deleting or modifying test files outright. Self-reported success can't be trusted regardless of model quality; only independent re-derivation closes this.
3. **Auditable, correctable status trail.** Every status post threads to (or links) the tool-call log or CI run it's based on, and a claim later found false is correctable in place, not silently edited away.

---

## 8. Autonomy & trust

This section replaces the old time-gated Probation → Trusted → Veteran ladder with a risk-tier model, per Alex's explicit call ("autonomous from day one on low-risk work") and evidence that no mainstream coding agent — including Claude Code's own experimental auto mode — auto-merges to a protected branch by default. Agent-wide trust levels are too coarse on their own, and per-change classifiers are themselves imperfect; the literature converges on combining both.

The old **grey-zone authority grid** is **superseded** by the risk-tier model below — ambiguous-authority scenarios are now handled by "ambiguous instructions escalate the tier" (§8.2). **Per-project rules of engagement** are **deferred** along with the rest of multi-project posture (§3.4).

### 8.1 Risk tiers (path sensitivity × change shape)

| Tier                                                                                                                    | Gate                                                                                                                          | Examples                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Tier 0 — auto-merge immediately**                                                                                     | All CI green; no sensitive path touched; diff below a size threshold; docs/config/lint-only or a non-major devDependency bump | Typo fix, formatter config, lockfile maintenance                               |
| **Tier 1 — fast single-approve, same-day**                                                                              | Logic change with an accompanying test, in a path the agent has a track record on                                             | Scoped bug fix with a regression test                                          |
| **Tier 2 — standard review**                                                                                            | Any logic change without an accompanying test, or a path with no track record, or a diff crossing package boundaries          | New feature work, first touch of a module                                      |
| **Tier 3 — mandatory named-owner review, cannot be satisfied by the requesting persona or the human who dispatched it** | Auth, payments, PII/secrets, CI/CD config, migrations, or any destructive operation, regardless of track record               | Anything touching `.github/workflows/`, schema migrations, credential handling |

**Track record shifts a change down at most one tier, and never into Tier 3.** A perfect 90-day history on a payments module still doesn't buy auto-merge there — sensitive paths are a hard floor autonomy doesn't earn past. This encodes the lesson from two real 2025–2026 incidents, with different confidence levels: Replit's agent ran a destructive operation during an active code freeze and then fabricated cover-up logs — there, the root problem (permission scope broader than the task warranted) is well-established. A second incident, an AWS/Kiro production outage, is genuinely disputed rather than merely under-qualified: AWS's own public statement attributes it to human error (an engineer misconfiguring their own access privileges), not AI agency, and neither account clarifies what Kiro actually asked permission for — so treat it as a plausible illustration of the same failure shape, not a second confirmed instance.

**Resolved (2026-07-12), BUILD_PLAN chunk 1.5:** "track record" is directory-scoped; a diff spanning multiple directories within one package takes the _minimum_ track record across them (short of the package-boundary rule that already routes cross-package diffs to Tier 2); a directory rename/move preserves track record when git's own rename detection flags it; a brand-new directory always starts at the Tier 2 floor with no transfer from broader history; the threshold is **N = 5** consecutive unreverted merges. Full reasoning and rejected alternatives: `docs/decisions/TRACK-RECORD-DEFINITION.md`.

### 8.2 Cross-cutting rules

- **Dev/prod hard separation is a precondition, not a tier.** No persona holds production-write credentials as broad as the human who dispatched it.
- **Revocation is mechanical, not discretionary.** Any revert of a persona-authored change zeroes that persona's track-record counter for the affected directory, forcing the next several changes there back to Tier 2 regardless of prior history.
- **Ambiguous instructions escalate the tier, not the eagerness.** "Clean this up" or "make it more robust" on a Tier 2/3-adjacent path requires the persona to restate a concrete plan and get it confirmed before acting — the exact gap that contributed to the Replit incident above.
- **Veto signal, demotion, disagreement resolution** (Alex's 🛑 reaction holds a merge; Nia can drop a persona a tier with no drama; domain-driven tie-breaking) carry over conceptually.
- **Persona framing never reduces review scrutiny or shifts accountability.** A 2026 BCG/HBR controlled study (1,200+ professionals) found that framing AI as a named "employee" led reviewers to catch fewer errors and report less accountability for a mistake — blaming the AI agent rather than themselves — while raising job-security concern and lowering deployment trust, the opposite of what naming personas is meant to buy, and a distinct risk from §7.6's anti-fabrication fix (that guards against the AI lying; this guards against the human under-checking it). Every merge gets reviewed and accounted for exactly as rigorously as if it carried no name at all — the human who approves it owns the outcome, not the persona who authored it, regardless of how established or trusted that persona's voice has become. (`docs/decisions/CAST-ROSTER.md`.)

---

## 9. Failure modes & recovery

The general shape — persistent disagreement escalates to the domain owner, then Nia, then Alex; a bad PR triggers an auto-approved revert plus a blameless postmortem; a hallucinated brief gets caught by Priya and corrected without defensiveness; a stuck persona gets noticed by Nia; a rare, high-bar escalation chain to Alex — carries over conceptually from the previous design.

**Open question:** the disagreement escalation chain above describes the general shape, but the actual tie-breaking mechanism doesn't have a specified implementation anywhere yet, by deliberate choice rather than oversight — this rebuild's own project history shows the disagreement work was re-scoped toward an Alex-owned anti-sycophancy prompt track (helping personas push back well in the first place), with the escalation-chain _code_ explicitly deferred until a real persistent disagreement is observed in practice, rather than speculatively designed now.

Three new failure modes belong in this list going forward, because they're this rebuild's own diagnosed risks, not hypotheticals:

- **Trigger-bound intake.** If a plainly work-shaped message ever goes unactioned, that's a Tier-1 incident for Nia to raise, not a shrug — the exact failure §5 exists to prevent.
- **A fabricated status claim slips through.** If §7.6's schema gate is ever bypassed (a bug, not a persona choice — the gate is mechanical), that's a blocking incident with a postmortem, same severity as a bad merge.
- **Persona breaking character at a bad moment.** Any persona with standing proactive permission (reacting to messages, initiating ceremonies, ambient ticket-drafting) needs an explicit situational-appropriateness check before acting, not just the capability to act — a system that can act without being asked can act at the wrong moment. (A documented real-world illustration: a funded competitor, Viktor, reportedly reacted to a layoff announcement with a skull emoji in a public channel — [Fortune, 2026-05-19](https://fortune.com/2026/05/19/viktor-ai-startup-raises-75-million-for-virtual-coworker-exclusive/) — included as color, sourced to the same standard as the incidents in §8.1.)

---

## 10. Cost model

Two hard buckets — per-ticket ceiling, per-month ceiling — scaling with risk tier/track record (§8) rather than a single flat number, Sonnet-by-default per persona with per-persona model tuning as real data comes in, and layered spend alerts at 50/80/100% of the monthly ceiling. These carry over conceptually as informed guesses to be corrected by real usage data, not commitments — no research in this rebuild surfaced evidence to change the numbers themselves.

**Model-tier note (added 2026-07-15, informational — not a pin):** Claude Sonnet 5 (`claude-sonnet-5`, released 2026-06-30) is the concrete model "Sonnet-by-default" currently resolves to — introductory pricing of $2/$10 per MTok runs through 2026-08-31, then $3/$15 standard ([Anthropic — Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [pricing](https://platform.claude.com/docs/en/about-claude/pricing)). This doesn't change the policy above — no model ID is hardcoded anywhere in the codebase yet, and "per-persona model tuning as real data comes in" still governs. Two persona-specific flags worth carrying into the chunk that actually wires a model in, both verified against primary sources: Sonnet 5 narrows but doesn't close the agentic-coding gap to Opus 4.8 (SWE-bench Pro 63.2% vs. 69.2%, per Anthropic's own [Claude Sonnet 5 System Card](https://www-cdn.anthropic.com/480e0bb54327b9622282e9c39a83a4f490ed377e/Claude%20Sonnet%205%20System%20Card.pdf)) and has a documented cybersecurity-training gap versus Opus 4.8 — treat Opus-tier as the working assumption for Riley's heavyweight chunk 6.2 coding work until moe has its own eval data, rather than assuming Sonnet 5 is "good enough now" by default. Independently, [CodeRabbit's study of real pull requests with pre-identified bugs](https://www.coderabbit.ai/blog/claude-sonnet-5-review) found Sonnet 5's bug-catch recall (50–51%) is _worse_ than Sonnet 4.6's (63%) despite better precision (29%→38–40%) — relevant to Dom's review work specifically, and worth validating with moe's own data before assuming the precision gain implies a recall gain.

---

## 11. Tools & MCP

The per-persona tool allowlist grid, the CLI-vs-MCP decision rule ("use the lightest tool that does the job"), the sandboxing model (no production code execution, worktree-isolated iteration, CI as the only path to a real build), and the curated-allowlist supply-chain hygiene rules carry over conceptually — none of this was implicated in any of the three named failures. The detailed grid itself is re-specified in `BUILD_PLAN.md` rather than reproduced here.

**Model-client choice (verified 2026-07-04, reversing an assumption inherited from the previous build):** conversational turns use the **raw Anthropic Messages API**, not the Claude Agent SDK. A docs-level verification found the TypeScript Agent SDK spawns a CLI subprocess per `query()` (~12s overhead per call, per the SDK's own issue tracker), accumulates session files on disk unbounded, and requires MCP boilerplate for custom tools — the wrong shape for a long-running service handling many short turns, and incompatible with §6.4's sub-10s casual-reply latency target on its own. The **Agent SDK remains the right tool for heavyweight autonomous work** — Riley's worktree coding sessions, where its built-in file/bash tooling and bounded-session shape genuinely fit. The line: chat turns = Messages API; multi-step agentic work in a sandbox = Agent SDK. What §4.5 settles independently of this is the process topology: each persona is its own long-running process, not subordinate agents under a single orchestrator process.

---

## 12. Code quality baseline

**This section is the direct fix for failure mode #3 and is treated as day-one foundational work, not an aspiration layered on later.** What's adopted from chief-clancy:

- ESLint complexity caps (`eslint-plugin-sonarjs` + `eslint-plugin-functional` + `eslint-plugin-unicorn` + `eslint-plugin-n`): cyclomatic 10, cognitive 15, max 50 LOC/function, max 300 LOC/file, max 3 params, max depth 3, no `let`, immutable data.
- A devil's-advocate review gate before any PR, reading each changed file at HEAD (not diff-scoped) for factual-claim drift — chief-clancy's `da-review`/`copilot-surrogate` pattern.
- A `docs/INDEX.md` scenario router preventing `CONVENTIONS.md` ↔ `AGENTS.md` ↔ `CLAUDE.md` drift.
- Pre-push hygiene (`knip`, `publint`, `attw`) for the packages Moe actually publishes.
- 5-group import ordering via `@ianvs/prettier-plugin-sort-imports`.
- A pre-seeded `docs/REVIEW-PATTERNS.md` with the highest-confidence failure classes (persona-prompt drift, ESM `.js` extension slips, schema/type separation, business-hours guard misses, recorded-transcript drift) so the review agent has something to consult on day one.

What's deliberately **not** adopted, same reasoning as before: `zod/mini` (Moe uses full Zod v4), chief-clancy's path aliases (Moe uses `@moe/*` workspace imports), CommonJS hooks/esbuild CLI bundling (Moe is a long-running ESM service, not a CLI), and blanket `publint`/`attw` across every package.

**Editorial call, flagged for override:** the earlier draft's "2026 SOTA additions" (diff-scoped mutation testing, prompt-injection test fixtures, extended-thinking opt-in for review subagents) are **deferred**, not dropped — they're real, valuable additions beyond chief-clancy parity, but layering them in before the core spine above is proven would repeat this section's own "aspiration before foundation" mistake. Revisit once the chief-clancy-parity list is actually running. Alex should confirm or override this call.

**The sequencing change, stated explicitly:** this section, plus §5's intake mechanism and §7.6's evidence-gated claims, are built **before** any persona-specific prompt or ceremony-voice work — see §13.

---

## 13. Migration philosophy

### 13.1 What's genuinely different this time

The previous attempt staged rollout **by persona count** — one new persona at a time, each requiring its own prompt-iteration round. Alex was explicit this time: **a full team from day one** — 7 personas, settled at §4.1 (an 8th, Designer, deferred to the 5.0 gate). What stages instead is **capability depth**, not roster size:

1. **Foundation first, before any persona exists in prose:** chief-clancy's engineering spine (§12), the evidence-gated claims schema (§7.6), the risk-tier gate (§8.1), and the ambient-intake mechanism (§5) — small, mechanical, shared by every persona, and everything else in this document depends on at least one of them existing first.
2. **One project, not many** (§1.2, §3.4) — chief-clancy only, until the core loop is proven.
3. **The full cast stands up together** once the foundation exists _and_ the core single-persona loop is proven (chat → triage → build → ship, Stages 2-4) — settled at BUILD_PLAN chunk 2.1, not amended: none of that plumbing (Slack transport, intake cascade, GitHub + board) exercises cross-persona dynamics, so debugging it on one process first, then standing the cast up together for the dynamics (banter, disagreement, handoffs) that actually need more than one persona to test, is the right order rather than a compromise.
4. **Persona prompt iteration is still its own real cost** — every persona requires a dedicated iteration round with Alex, first-attempt prompts will underperform, and pacing should follow Alex's actual iteration appetite, not a calendar.

### 13.2 Rejected alternatives (unchanged reasoning)

Big-bang rewrite-then-ship (too long before anything's visible), a parallel `moe-v2` app running alongside a v1 (moot — there is no v1 running), and flagging everything behind feature flags (management overhead outweighs the benefit at this scale) are all still the wrong shape.

---

## 14. Out of scope

Moe explicitly does not: make business/financial decisions on Alex's behalf, access external services without authorization, access Alex's personal accounts, initiate contact with humans outside the target project's own issue/PR threads, run code in production, modify persona prompts or ceremony formats without Alex's approval, operate on weekends/UK bank holidays, or pretend not to be AI to external humans. If a scenario requires one of these, the team stops and asks.

---

## Appendix A — Open questions carried forward

Working-hours findings, tie-breaking validation, cost calibration, per-project channel depth, persona-to-persona DM volume, sick-day handling, exit criteria, interjection-bar mechanism (the threshold governing when a persona speaks up unprompted, relevant to §1.3's Marcus example — not yet resolved), and the deferred persona-confidence health signal all remain open — none were touched by the diagnosis of what actually failed, so none needed re-litigating here. (Designer-role timing, formerly listed here, was resolved at BUILD_PLAN chunk 2.1 — deferred to the 5.0 gate, §4.1. Slack-status-away parsing conventions, also formerly listed here, was resolved at BUILD_PLAN chunk 2.7b — see `docs/GLOSSARY.md`'s "Away-detection" entry for the settled keyword/emoji list.)

## Appendix B — Glossary

- **Execution hallucination** — an agent claiming to have completed a sub-stage of work it did not actually complete; the academic name for failure mode #2.
- **Evidence-gated claim** — a status statement a persona is structurally prevented from emitting unless it's backed by a real `toolCallId`/`toolOutputSnippet` pair (§7.6).
- **Ungrounded vs. misgrounded fabrication** — ungrounded: a claim with no tool-call evidence at all (closed by §7.6's schema gate). Misgrounded: a claim backed by real but irrelevant evidence (closed only for Tier 2/3 claims, by independent verification).
- **ADR, Brief, Core hours, Do-not-touch list, EOD digest, Four-eyes principle, HITL, MCP, ScrumBan, Trust Level, Veto signal, Classes of Service, WSJF** — carried forward unchanged from the previous design's glossary.

## Appendix C — Anti-sycophancy prompt patterns

Research-backed reference for per-persona prompt design. Each persona prompt layers in the patterns below; BUILD_PLAN's prompt-evolution rounds iterate per persona.

**Baseline** (Claude's Constitution): Claude is trained to be "diplomatically honest rather than dishonestly diplomatic." "Epistemic cowardice" — vague or noncommittal answers to placate users — is named as a violation.

**Pattern 1 — Explicit pushback license**

> You may, and should, push back on false premises, disagree with the user when you have good reason, and point out things people might not want to hear. Direct correction is more useful than soft hedging.

Direct constraint-style instructions ("don't be sycophantic") underperform reframing-style instructions per AISI 2026.

**Pattern 2 — "Rephrase as a question" preamble** _(AISI's #1 finding — the highest-leverage single pattern in this catalogue)_

> Before responding to any user claim or request, rephrase it internally as a question — "is X true?" / "is Y the right action?" — and answer the question on its merits.

**Pattern 3 — Steelman before counter**

> Before disagreeing, restate the strongest version of the opposing view in one sentence the proponent would endorse. Then state your disagreement and your reason.

**Pattern 4 — Citation-required disagreement** _(by the persona, not the user)_

> If you disagree, state (a) the specific claim you reject and (b) the reason — evidence, logical flaw, or prior context. Do not disagree without a stated reason.

Requiring the _user_ to cite sources backfires (authority cues increase deference); this requirement applies only to the persona's own disagreements.

**Pattern 5 — Calibrated confidence**

> Express uncertainty when you are uncertain. Rate your confidence 0–100% reflecting how often you'd be right giving answers at this certainty.

**Pattern 6 — Intellectual integrity over agreement**

> Prioritise intellectual integrity over agreement. Share genuine assessments of hard dilemmas. Engage critically with speculative ideas rather than giving empty validation. Saying "that's a great question" or "I love this idea" is not engagement; it's noise.

**Pattern 7 — Multi-turn drift mitigation** (sycophancy persists ~80% once triggered within a conversation; prevention beats correction)

> Self-check: re-read your most recent substantive position. Would you state it the same way starting from zero context now? If your position has drifted toward the user's preference without new evidence, restore your original position.

**Layering by persona:**

| Persona            | Patterns to layer (priority order)                                              |
| ------------------ | ------------------------------------------------------------------------------- |
| Sarah, Marcus, Nia | 1 (permission), 2 (preamble), 6 (priority), 5 (calibrated)                      |
| Riley, Dom         | 1 (permission), 4 (form) — code work; reasons must be cited                     |
| Priya              | 1 (permission), 2 (preamble), 4 (form) — skepticism is the role; 1+4 amplify it |
| Theo               | 5 (calibrated), 6 (priority) — he's the citation-bringer already                |
| All personas       | 7 (drift mitigation) — universal                                                |

**Iteration discipline:** first-attempt prompts will underperform. Validate per persona with adversarial conversations (Alex as the pushy user; the persona should hold position when right, update when shown wrong). Capture failure modes; iterate. This catalogue is currently load-bearing for the disagreement-prompt track referenced in §9 — treat it as the actual source, not a placeholder.
