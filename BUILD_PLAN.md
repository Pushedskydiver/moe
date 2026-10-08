# BUILD_PLAN.md — moe v3

> **Sizing discipline (Alex's explicit rule):** every chunk below is small, safe, and simple — roughly one PR, one sitting, one reviewable idea. Anything that turned out bigger during drafting got split. If a chunk turns out to be complex _during implementation_, stop and split it rather than pushing through — a chunk that grows past ~300 changed LOC of real logic (excluding lockfiles/scaffolding boilerplate) is a signal to split, not a target to squeeze under.
>
> **Reading order:** `docs/VISION.md` (product truth) → `AGENTS.md` (engineering rules) → this file (sequence). Where this file conflicts with VISION.md, VISION.md wins.
>
> **Chunk states:** `[ ]` not started · `[~]` in progress · `[x]` merged · `[GATE]` needs an Alex conversation/decision before starting — not buildable until the gate clears.
>
> **Finished chunks** keep only their title and a date here. Each one's full spec and build narrative moved verbatim to `docs/history/BUILD-NARRATIVE.md` (2026-09-27), under a heading per chunk id (5.3's sub-chunks 5.3a–5.3h sit inside §5.3), so a `BUILD_PLAN x.y` citation anywhere in the repo resolves there. Read it only when a live line points at it. Each finished stage's **Status** line below records what the phase ledger and narrative say about its completion.

---

## How the stages ladder up

```
Stage 0  Repo skeleton + engineering spine        (nothing moe-specific yet)
Stage 1  Core domain: tickets, claims, database    (pure logic + one DB table at a time)
Stage 2  One persona process, one Slack app        (prove the loop with N=1 before N=8)
Stage 3  Intake: chat → ticket                     (the #1 failure-mode fix, on N=1)
Stage 4  GitHub + the board                        (tickets become real work on chief-clancy)
Stage 5  The full cast                             (N=1 → N=8, gated on the cast redline)
Stage 6  Team behaviour: handoffs, review, merge   (personas working together)
Stage 7  Ceremonies                                (retro, replenishment, monthly review)
Stage 8  Memory & growth                           (voice consistency over months)
```

Each stage ends with something observable working end-to-end. **The gating rule, precisely:** a stage starts when the previous stage's _exit criterion_ is met — not when every chunk in it is checked. Chunks an exit criterion doesn't cover may float across the boundary, with these hard orderings: 0.6a–0.6c/0.7 land before Stage 1's first PR; 1.5/1.6 land before Stage 5's first 5.3 sub-chunk (VISION §13.1's item 1 puts the risk-tier gate in the foundation, before any persona exists in prose); 3.6 may trail into Stage 4; 7.6 is independent and may be pulled earlier. That's the anti-scope-spiral mechanism, per VISION §13.

**On VISION §13.1's "the full cast stands up together":** this plan runs N=1 through Stages 2–4 because the plumbing those stages build (Slack transport, intake cascade, GitHub + board) is persona-independent and cheaper to debug on one process than eight — none of it is cross-persona dynamics. The cast then stands up together as one stage (Stage 5), not one-persona-at-a-time rollout. **Resolved at chunk 2.1:** this ordering is confirmed, not amended away — VISION §13.1's item 3 now says so explicitly.

---

## Stage 0 — Repo skeleton + engineering spine

**Exit criterion:** `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm knip` green in CI on a hello-world monorepo; the review-gate agents exist and have been exercised once.

**Status:** marked complete 2026-07-10, at 0.7 (phase ledger).

- [x] **0.1 — git init + pnpm workspace skeleton.** Shipped 2026-07-04. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.1.
- [x] **0.2 — Lint/format config to CONVENTIONS.md spec.** Shipped 2026-07-04. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.2.
- [x] **0.3 — eslint-plugin-boundaries + the settled package graph.** Shipped 2026-07-04. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.3.
- [x] **0.4 — CI pipeline.** Shipped 2026-07-04. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.4.
- [x] **0.5 — Review-gate agents ported.** Shipped 2026-07-04. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.5.
- [x] **0.6a — Process docs.** Shipped 2026-07-04. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.6a.
- [x] **0.6b — Review canon.** Shipped 2026-07-09. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.6b.
- [x] **0.6c — Reference docs + port decision.** Shipped 2026-07-10. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.6c.
- [x] **0.7 — `generate:agents-md` script.** Shipped 2026-07-10. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §0.7.

## Stage 1 — Core domain: tickets, claims, database

**Exit criterion:** two concurrent fake persona processes race to claim the same ticket in an integration test; exactly one wins, every status message about it carries evidence.

**Status:** marked complete 2026-07-15, at 1.6 (phase ledger).

- [x] **1.1 — Ticket types + Zod schemas.** Shipped 2026-07-10. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §1.1.
- [x] **1.2a — [GATE] Process topology × DB access ADR.** Shipped 2026-07-11. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §1.2a.
- [x] **1.2b — Database layer + tickets table.** Shipped 2026-07-11. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §1.2b.
- [x] **1.3 — Atomic claim.** Shipped 2026-07-11. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §1.3.
- [x] **1.4 — StatusClaim schema + composer gate.** Shipped 2026-07-11. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §1.4.
- [x] **1.5 — [GATE] Track-record definition ADR.** Shipped 2026-07-11. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §1.5.
- [x] **1.6 — Risk-tier classifier.** Shipped 2026-07-15. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §1.6.

## Stage 2 — One persona process, one Slack app

**Exit criterion:** one persona (Sarah, confirmed at 2.1 as front-door) runs on Fly, has her own Slack App, responds to a DM, and every work-status statement she makes carries §7.6 evidence.

**Status:** marked complete 2026-07-18, at 2.7b (phase ledger); its Fly half was first met by 5.2's deploy, 2026-07-25.

- [x] **2.1 — [GATE] Cast redline conversation.** Shipped 2026-07-15. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.1.
- [x] **2.2 — Persona process skeleton.** Shipped 2026-07-15. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.2.
- [x] **2.3 — Slack app + inbound events.** Shipped 2026-07-16. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.3.
- [x] **2.4a — LLM reply loop (stateless).** Shipped 2026-07-16. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.4a.
- [x] **2.4b — Thread-scoped conversation state.** Shipped 2026-07-17. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.4b.
- [x] **2.5 — Status messages through the claim gate.** Shipped 2026-07-17. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.5.
- [x] **2.6a — Cost metering substrate.** Shipped 2026-07-17. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.6a.
- [x] **2.6b — Caps + alert ladder.** Shipped 2026-07-17. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.6b.
- [x] **2.7a — Core-hours + bank-holiday guard.** Shipped 2026-07-18. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.7a.
- [x] **2.7b — Away-detection.** Shipped 2026-07-18. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §2.7b.

## Stage 3 — Intake: chat → ticket (failure-mode #1's fix)

**Exit criterion:** VISION §0's failure #1, inverted, now passes as a live test — paste a GitHub issue link (or a plain "this needs looking into") in **a DM or** a scoped channel, no @-mention, no command, and a ticket draft appears with a reaction gate. At this stage the issue-link case produces a **link-only draft** (the URL plus whatever the message said) — issue title/body enrichment arrives with 4.1/4.4b, since Stage 3 has no GitHub client.

**Status:** marked complete at 3.5 (2026-07-19) and 3.6 (2026-07-20); met on both halves 2026-07-26, when 3.7 live-verified the DM half (history note below).

> **History of this criterion (resolved 2026-07-25, at chunk 3.7).** It originally read "in a DM or scoped channel". Chunk 3.3 then resolved chat replies as **DMs-only** and, symmetrically, routed the intake cascade to non-DMs only (`handle-inbound-message.ts`: `if (message.channelType !== 'im')` → cascade, then `return`; a DM went to the chat-reply path and never reached Stage 1). That was a deliberate, Alex-confirmed decision, but nobody reconciled it against this criterion, which predates it — so **Stage 3 read as passing a test its own code could not pass, from 3.3 merging until 3.7**. The channel half genuinely passed throughout and was live-verified at 3.4a-iii. The DM half was filed as chunk **3.7** and is now built, restoring the original wording rather than keeping the narrowed one. Worth remembering as a pattern: an exit criterion is not self-maintaining, and a chunk that changes routing needs to be checked against the criterion of the stage it sits in.

- [x] **3.1 — [GATE] Stage-1-classifier spike.** Shipped 2026-07-18. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.1.
- [x] **3.2 — Channel scoping (Stage 0 of the cascade).** Shipped 2026-07-18. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.2.
- [x] **3.3 — Classifier gate (Stage 1 of the cascade).** Shipped 2026-07-18. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.3.
- [x] **3.4a-i — High-band auto-draft.** Shipped 2026-07-18. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.4a-i.
- [x] **3.4a-ii — Reaction listener + outcome paths.** Shipped 2026-07-18. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.4a-ii.
- [x] **3.4a-iii — Minimal situational-appropriateness gate.** Shipped 2026-07-19. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.4a-iii.
- [x] **3.4b-i — Mid-band confirming question (ask-side).** Shipped 2026-07-19. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.4b-i.
- [x] **3.4b-ii — Mid-band confirming question (answer-side).** Shipped 2026-07-19. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.4b-ii.
- [x] **3.4c — Review-queue table + Low-band silent log.** Shipped 2026-07-19. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.4c.
- [x] **3.5 — Review-queue sweep.** Shipped 2026-07-19. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.5.

- [x] **3.6 — Draft-outcome tracking.** Shipped 2026-07-20. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.6.

- [x] **3.7 — Intake cascade on DMs.** Shipped 2026-07-25. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.7.

- [x] **3.8 — Ignore Slackbot's own notification DMs.** Shipped 2026-07-28. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.8.

- [x] **3.9 — Off-hours ambient intake is dropped, not deferred.** Shipped 2026-07-28. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.9.

- [x] **3.10 — The ambient guard chain's two remaining silent losses.** Shipped 2026-07-28. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.10.

- [x] **3.11 — `classifyMessageForIntake`'s own classification-failure silent loss.** Shipped 2026-07-29. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.11.

- [x] **3.12 — The Stage 1 classifier treats a question _about_ work as work needing a ticket.** Shipped 2026-08-02. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.12.

- [x] **3.13 — A committed Haiku eval for the Stage 1 classifier and the safety gate.** Built 2026-10-08. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §3.13.

## Stage 4 — GitHub + the board

**Exit criterion:** a ticket created from chat exists as a tracked item against chief-clancy, and an externally-opened GitHub issue appears in the triage queue and can be linked to a ticket. Persona-driven conversion of a triage-queue entry into a board ticket was deliberately not a Stage-4 capability — it's Sarah's Brief-stage triage behaviour, and landed at chunk 6.1b (below), where the pull loop lives.

**Status:** marked complete 2026-07-24, at 4.6 (phase ledger).

- [x] **4.1 — GitHub App auth + client.** Shipped 2026-07-21. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.1.
- [x] **4.2 — Issue discovery (poll).** Shipped 2026-07-22. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.2.
- [x] **4.3 — [GATE] Board home + capacity-model decision.** Shipped 2026-07-22. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.3.
- [x] **4.4a — External-post attribution (AI transparency).** Shipped 2026-07-22. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.4a.
- [x] **4.4b — Outbound ticket → issue creation/link.** Shipped 2026-07-23. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.4b.
- [x] **4.4c — Reconciliation poll.** Shipped 2026-07-23. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.4c.
- [x] **4.5 — WIP limits + classes of service enforcement.** Shipped 2026-07-23. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.5.
- [x] **4.6 — DB backup + tested restore.** Shipped 2026-07-24. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §4.6.

## Stage 5 — The full cast

**Exit criterion:** all 8 personas from the cast redline (2.1, completed at 5.0) run as separate processes with separate Slack apps; each has a distinct, Alex-approved voice; a DM to any of them gets an in-character response — a conversational reply, or, when the 3.7 cascade classifies the DM as High/Mid band, a ticket draft or confirming question in its place.

**Status:** exit criterion met 2026-08-28, at 5.3h (phase ledger). Stage 6 is formally open; 5.5 and 5.6 may still land.

- [x] **5.0 — [GATE] Cast redline completion.** Shipped 2026-07-24. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.0.
- [x] **5.1 — Multi-app credential config + provisioning script.** Shipped 2026-07-24. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.1.
- [x] **5.2 — N-process deployment.** Shipped 2026-07-25. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.2.
- [x] **5.2a — Ambient intake scoping.** Shipped 2026-07-27. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.2a.

- [x] **5.2b — Claim-first draft/question posting (defence-in-depth for 5.2a).** Shipped 2026-07-28. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.2b.

- [x] **5.3 — Persona prompts, one at a time.** Shipped 2026-08-28 (sub-chunks 5.3a 2026-07-31, 5.3b 2026-08-09, 5.3c 2026-08-09, 5.3d 2026-08-10, 5.3e 2026-08-10, 5.3f 2026-08-15, 5.3g 2026-08-18, 5.3h 2026-08-28; each inside §5.3). Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.3.
- [x] **5.3a-ii — Wire real persona prompts into all three cascade call sites, plus prompt caching.** Shipped 2026-08-01. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.3a-ii.
- [x] **5.4 — Persona-replay test harness.** Shipped 2026-08-09. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §5.4.
- [ ] **5.5 — Welcome ritual.** How the team welcomes each newly-activated persona in `#moe-team` — an open question in VISION §4.1, not a settled mechanic, so this chunk opens by settling the format with Alex (its own mini-gate; default proposal: one thread per join), then implements it. Small, pure team-feel, cheap.
      **Archived notes for this chunk:** §5.2a in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **5.6 — [GATE] Conversational channel presence (banter).** VISION promises this and no chunk builds it. §6.1 lists `#moe-random` as a real channel ("Non-work banter") and `#moe-team` as carrying "banter" alongside digests and work updates; §13.1 item 3 names banter as one of the cross-persona dynamics the whole cast was stood up together to test ("standing the cast up together for the dynamics (banter, disagreement, handoffs) that actually need more than one persona to test"). But **chunk 3.3 made conversational replies DMs-only** — an ambient channel message is classified and may yield a ticket draft, never a chat reply — and every channel-posting chunk on the plan (5.5 welcome ritual, 6.7a incident posts, 7.6 EOD digest) posts something _structured and proactive_, not conversation. So a persona currently cannot talk in a channel at all. Discovered 2026-07-25 when Alex asked whether the team would respond in `#moe-random`.
      **This is a [GATE] because the naive implementation is actively bad.** Eight personas each replying to every message in a shared channel is eight bots talking over each other and over Alex — worse than silence, and it would land squarely on VISION §5.4's trust-erosion rule. Opens by settling with Alex, its own mini-gate like 5.5's: what triggers a conversational reply in a channel at all (addressed-only? a probability? one designated responder per thread?), how many personas may respond to one message, and what rate limit or cooldown applies. Options exist but this is an Alex call, not something to invent.
      **Do not implement by adding `#moe-random` to `MOE_WORK_RELEVANT_CHANNEL_IDS`.** That variable gates the _work-intake_ pipeline (Stage 0 → classifier → draft); putting the banter channel in it would feed jokes to the ticket classifier, which is exactly what VISION §5.2's Stage 0 exists to prevent. A social path bypasses that pipeline rather than joining it.
      **Sequencing: after 5.3.** Banter from eight identical placeholder prompts proves nothing about whether the dynamic works — the behaviour only becomes evaluable once personas have real, distinct voices. Also worth landing after **5.2a**, which settles the adjacent question of what a persona does with a channel message it _isn't_ the intake listener for.
      **Archived notes for this chunk:** §5.2a in `docs/history/BUILD-NARRATIVE.md`.

## Stage 6 — Team behaviour: handoffs, review, merge

**Exit criterion:** a ticket flows Brief → Plan → Build → Review → merged-to-chief-clancy across at least three different personas, with the risk-tier gate deciding the merge path, without Alex driving. The proving ticket is expected to take the Tier 1 path — Dom's 6.3b approval satisfies the fast single-approve, then the merge is automatic; Alex having flipped the 6.5a-ii enforcement switch beforehand doesn't count as driving.

- [x] **6.0 — [GATE] Per-persona tool allowlist grid.** Shipped 2026-08-28. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.0.
- [x] **6.1a-i — Pull loop + atomic claim.** Shipped 2026-08-30. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1a-i.
- [x] **6.1a-ii — Stage transitions + WIP gate.** Shipped 2026-09-01. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1a-ii.
- [x] **6.1b — Brief-stage handler.** Shipped 2026-09-03. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1b.

- [x] **6.1c — Plan-stage handler.** Shipped 2026-09-05. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1c.

- [x] **6.1d — Reaction semantics on briefs and artifacts.** Shipped 2026-09-06. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1d.
- [x] **6.1e — Reaction semantics on Plan→Build.** Shipped 2026-09-10. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1e.

- [x] **6.1f — Reaction semantics, persona-side (react-instead-of-reply tool).** Shipped 2026-09-10. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1f.

- [x] **6.1g — Wire react-instead-of-reply live.** Shipped 2026-09-10. Spec and build narrative: `docs/history/BUILD-NARRATIVE.md` §6.1g.

- [ ] **6.2 — Worktree sandbox for Riley.** Per-task git worktree, scoped writes per the 6.0 grid, no secrets access (VISION §11's sandboxing model). Code lands only via PR + CI. This is where the Claude Agent SDK enters — bounded multi-step coding sessions are the shape it's built for (VISION §11's chat-vs-agentic line).
      **Archived notes for this chunk:** §2.4a, §5.3, §6.0, §6.1c in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.3a — Riley opens PRs.** Branch/push from the 6.2 worktree, PR body composition (carrying 4.4a's attribution + footer — PRs and review comments are external surfaces too), the GitHub write path. Exit: a real PR appears on chief-clancy from a Build ticket.
      **Archived notes for this chunk:** §6.1e in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.3b — Dom review pass.** Fetch the diff, an in-voice review process (his own process, his own voice), post approve/request-changes with his reasoning, attributed per 4.4a.
      **Archived notes for this chunk:** §6.1c in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.3c — Changes-requested → rework loop.** Route Dom's request-changes back to Riley, rework, re-request review. The state machine's edges live here: repeated rounds, stale reviews, who transitions the ticket.
- [ ] **6.3d — Priya QA pass.** Her cross-cutting second review — additive by design: the Brief→merge flow proves out without her, then she joins.
      **Archived notes for this chunk:** §6.1a-i in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.4a — CI-result verification.** The deterministic verifier for "tests pass" claims — fetch the CI run, compare, wire to the 1.4 claim gate. Small, and it covers the highest-volume Tier 2/3 claim type.
- [ ] **6.4b — Disjoint-context verifier subagent.** For the remaining Tier 2/3 claim types (VISION §7.6 layer 2): its own prompt, plumbing that feeds it the raw tool-call log and nothing else, an output schema, and handling of verifier disagreement. Wired to the 1.4 claim gate.
      **Archived notes for this chunk:** §2.5 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.4c — Auditable status trail.** VISION §7.6 layer 3: every status post threads to (or links) the tool-call log or CI run it's based on, and a claim later found false is corrected in place, not silently edited away.
- [ ] **6.5a-i — Tier routing, shadow only.** The 1.6 classifier routes per VISION §8.1's table verbatim: Tier 0 auto-merge; Tier 1 fast single-approve (Dom's 6.3b approval satisfies it; the merge is then automatic); Tier 2 standard review; Tier 3 mandatory named-owner review that cannot be satisfied by the requesting persona or the human who dispatched the work. Who can review Tier 3 at all on a one-human team is the explicit Alex decision from the 6.0 gate — it is not "Alex reviews" by default. Includes the track-record table migration (schema per the 1.5 ADR), seeded/static rows for now — 6.5b makes it live. Same pattern as 3.3 for the same class of risk: shadow only — log "would have auto-merged / fast-approved / routed" decisions on real PRs; no merge-write capability exists in the code yet.
      **Blocked on two undefined parameters, added 2026-07-25.** Tier 0's gate is "no sensitive path touched; diff below a size threshold" (VISION §8.1) and Tier 3's floor names "Auth, payments, PII/secrets, CI/CD config, migrations" in prose — but neither the sensitive-path matcher nor the size threshold exists as a concrete definition anywhere. `classifyRiskTier` (1.6) takes path/change-shape inputs; something has to decide what feeds it. This chunk cannot even shadow-log a Tier 0 decision without both, so settle them here — a path glob set and a numeric LOC/file threshold, in `docs/decisions/` alongside `TRACK-RECORD-DEFINITION.md`'s own N=5 precedent — before 6.5a-ii turns the switch on.
      **Archived notes for this chunk:** §3.4a-i, §5.3, §6.0 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.5a-ii — Merge-action executors.** The Tier 0 auto-merge write (the highest-blast-radius action in the plan), the Tier 1 merge-after-Dom-approves path, and route-to-review, behind an Alex-controlled enforcement switch. Check chief-clancy's branch protection first: GitHub deliberately blocks bots/agents from satisfying required-review rules, so if `main` requires a human approval, Tier 0/1 auto-merge needs a repo-config decision with Alex (part of flipping the switch, not a surprise after it). The switch may not flip until 6.5b and 6.5c are merged, the track record is being earned by real merges rather than seeded rows, and the 6.5a-i shadow log looks right. Shadow mode may run without those preconditions; enforcement may not.
      **Archived notes for this chunk:** §6.1e in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.5b — Track record: earn + revoke.** The write path VISION §8.1/§8.2's trust model runs on. Earn: each unreverted persona-authored merge increments the per-directory counter (threshold N per the 1.5 ADR). Revoke: detect reverts of persona-authored merges; a revert zeroes the affected directory's counter — revocation is mechanical. Also carries §8.2's demotion lever: a manual tier/track-record override writable by Nia or Alex ("drop a persona a tier with no drama"), a one-row write on the same table.
      **Archived notes for this chunk:** §5.3 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.5c — 🛑 veto hold.** The Slack reaction listener that holds any in-flight merge on Alex's 🛑. A precondition, with 6.5b, for the 6.5a-ii enforcement flip.
- [ ] **6.6 — Blocked/stuck/kick-back paths.** Plan-was-wrong kick-back, blocked-ticket posting, Nia's stall detection ("you've been quiet for an hour, all good?"), and stale-claim recovery (a `releaseTicket` call that itself fails its own CAS orphans a claim — named and deliberately deferred here by 6.1a-ii, which scoped itself to the transition function + WIP gate only; needs a new `claimedAt` column and a staleness-threshold judgment call with no calibration data yet). Four small handlers, one chunk each if they grow.
      **Archived notes for this chunk:** §5.3, §6.1a-ii, §6.1c in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.7a — Incident posting path + postmortem skeleton.** Gives `#moe-incidents` its behaviour (VISION §9): the posting path plus the blameless-postmortem composition flow, with 6.5b's revert detection as the first producer — a revert of a persona-authored merge posts here with a postmortem. Also settles §9's revert-_execution_ path, not just its detection: on a detected bad persona-authored merge, who authors the revert PR and under what gate it merges ("auto-approved" ≈ a Tier-0-style fast path that skips the normal review queue) — an Alex call inside this chunk. Land after first live merge traffic.
      **Archived notes for this chunk:** §5.2a in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.7b — Schema-gate-bypass detector.** A §7.6 schema-gate bypass raised as a blocking incident with a postmortem.
- [ ] **6.7c — Unactioned-message detector.** Nia raises a work-shaped message that went unactioned as a Tier-1 incident — a background scan over the intake plumbing with its own state and false-positive tuning.
      **Archived notes for this chunk:** §5.2a, §5.3 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.8 — Per-ticket + tier-scaled cost ceilings.** The VISION §10 buckets deferred at 2.6b: the per-ticket ceiling, and caps scaling with risk tier/track record, now that tickets and tiers are both live.
      **Archived notes for this chunk:** §2.6b in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **6.9 — Persona-to-persona DMs.** VISION §6.2 promises personas "can DM each other, as genuinely separate, individually-addressable Slack identities", and §6.6's whole one-app-per-persona reversal rests on a persona being a real, DMable identity — but nothing builds a persona _sending_ a DM to another persona. `postMessage` can technically target a user id (that is how cost alerts reach Alex), so the transport exists; what is missing is any path where persona A addresses persona B, plus the receiving side actually treating it as from a teammate rather than a human. **Not a duplicate of the handoff mechanism** — VISION §5.3 settles that work handoffs go through the database (write, then poll-claim), deliberately _not_ a Slack message, and that decision stands. This chunk is for the conversational cases §6.6 names, of which the concrete one already on the plan is Nia's stall detection ("you've been quiet for an hour, all good?"), which is one persona addressing another and is silently undeliverable today. Settle scope with Alex: which persona-to-persona messages are wanted at all, given the risk of bots talking to each other in a loop.
- [ ] **6.10 — Theo's research output.** VISION §6.1 gives `#moe-research` exactly one purpose — "Theo's domain — deep-dives, citations" — and §4.1 has a Researcher on the roster, but no chunk builds the behaviour: nothing produces a research artifact, nothing posts to `#moe-research`, and the channel is in `MOE_WORK_RELEVANT_CHANNEL_IDS` purely as an _intake_ surface. **The risk is that this passes unnoticed:** Stage 5's exit criterion is only "a DM to any of them gets an in-character reply", so Theo satisfies it while doing nothing a researcher does. Sequence after whichever 5.3 sub-chunk lands Theo's prompt (5.3c went to Marcus instead — nothing pins the order, see 5.3's own text), and settle what triggers a deep-dive (a ticket type? an Alex ask? a persona asking Theo?) — the trigger is the real question, not the posting.
      **Archived notes for this chunk:** §5.2a in `docs/history/BUILD-NARRATIVE.md`.

## Stage 7 — Ceremonies

**Exit criterion:** one full ceremony cycle (a Friday retro, a Monday replenishment, one monthly review) has run live with Alex participating, and felt like a conversation rather than a template.

- [ ] **7.1 — [GATE] `docs/CEREMONIES.md` consolidation.** Co-author with Alex (do-not-touch surface): consolidate the ceremony mechanics from the v2 chunk-history into the canonical doc. **Decision/writing chunk — blocks the rest of Stage 7.**
      **Must settle multi-persona contribution, added 2026-07-25.** VISION §3.2 calls synthesized qualitative reflection "a real, currently-unclaimed differentiator" against Slackbot/Viktor/MGX/ChatDev, and Stage 7's own exit criterion asks that a ceremony "felt like a conversation rather than a template". Both require personas _other than the ceremony owner_ to contribute — a retro where only Nia speaks is a template. Nothing on the plan gathers per-persona reflections or synthesizes them, and this gate is where the mechanic gets decided (does the owner solicit in-thread and wait? do personas poll for an open ceremony? is there a timeout?) before 7.3b composes and posts anything.
- [ ] **7.2a — Ceremony scheduler.** Cron-shaped triggers (Friday retro, Monday replenishment, first-business-day review), consuming 2.7a's core-hours/bank-holiday module. Ceremony initiation runs through the 3.4a-iii situational-appropriateness gate — VISION §9 requires it for ceremony-initiating personas, and 8.5's full version lands a stage later. No ceremony content — just "it fires at the right time".
      **Archived notes for this chunk:** §2.7a, §3.5, §3.9 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **7.2b — Alex-away ceremony policy.** Away detection via 2.7b's Slack-status module, plus the explicit per-ceremony policy for what a ceremony does when Alex is away — skip, defer to the next business day, or run without him. That policy is Alex's to set (small decision attached), not an implicit scheduler default.
      **Archived notes for this chunk:** §2.7b in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **7.3a — Replenishment section data.** The four sections' data gathering as pure functions over the board/DB. Smallest ceremony first.
- [ ] **7.3b — Replenishment composer + runner.** Sarah's voiced four-section Monday thread: composition + posting, over 7.3a's data.
      **Archived notes for this chunk:** §5.3 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **7.4a-i — Retro round/synthesis logic.** Round definitions, per-round reply aggregation, and the inter-round synthesis prompts as pure, unit-testable functions — the same a/b shape 7.3 and 7.5 use, applied to the hardest ceremony mechanic.
      **Archived notes for this chunk:** §5.3 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **7.4a-ii — Retro thread runner.** Nia's live five-round Friday thread, plain-text rounds only: posting rounds, collecting replies with timeouts, advancing round state, over 7.4a-i's logic. This satisfies "a Friday retro has run live".
      **Archived notes for this chunk:** §5.3 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **7.4b — Retro satisfaction picker.** The interactive component: block-kit UI + interaction handler + persistence of the response.
- [ ] **7.4c — Retro action items.** Extraction from the thread, the ≤3 cap, owner assignment, persistence.
- [ ] **7.5a — Monthly-review section builders.** Per-section data gathering/synthesis as pure, unit-testable functions (VISION §3.2's six-section shape, per the 7.1 doc).
      **Archived notes for this chunk:** §5.3 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **7.5b — Monthly-review composer + runner.** The two-voice ceremony: Sarah's sections, Nia's sections, the handoff between them, reusing 7.3/7.4's plumbing.
      **Archived notes for this chunk:** §5.3 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **7.5c — Monthly-review persistence.** The persisted write-up: format, storage location, and read-back path. The location is decided explicitly here — Fly's deployed `docs/` is effectively read-only, so a data-volume path is the likely answer (the v2 lesson).
- [ ] **7.6 — EOD digest.** Nia's end-of-day post (shipped/in-flight/blocked/cost). Listed last but independent — a floating chunk per the gating rule; pull it earlier if Alex wants it sooner.
      **Archived notes for this chunk:** §5.2a, §5.3 in `docs/history/BUILD-NARRATIVE.md`.

## Stage 8 — Memory & growth

**Exit criterion:** a persona references something true from >2 weeks ago unprompted, correctly, in-character — verified by procedure, not by hoping. Seed a known memory when 8.1 lands; from two weeks after, Alex holds a conversation adjacent to it (not asking for it) and judges the recall for accuracy and voice; if it hasn't surfaced naturally within four weeks of 8.5 merging, run that adjacent-topic probe deliberately as the fallback test.

- [ ] **8.1 — Memory store + per-persona namespaces.** `/data/memories/<personaId>/...` with the path guard, `{personaId, projectKey, scope, createdAt}` tagging, save/recall functions.
      **Archived notes for this chunk:** §4.6 in `docs/history/BUILD-NARRATIVE.md`.
- [ ] **8.2 — Recall into context.** Persona activation loads `_global` + project + team-lore namespaces. Privacy rule enforced (DM vents never persisted — VISION §6.2).
      **Owes the summaries half, added 2026-07-25.** VISION §7 carries "working memory + summaries" forward as sound-in-concept, and Stage 8's exit criterion — "a persona references something true from >2 weeks ago unprompted, correctly, in-character" — depends on older context being _condensed into something durable_ rather than dropped. Retrieval over raw stored turns is not the same capability: `conversation_turns` (2.4b) accumulates without any condensation step, so without summaries this stage's criterion rests on searching an ever-growing raw log. Decide here whether summaries are a scheduled condensation job, a write-time rollup, or explicitly rejected in favour of raw retrieval.
- [ ] **8.3 — Model-of-Alex loop.** Passive per-persona observations of Alex's working style, recalled into context. No new model calls — piggyback on existing turns.
- [ ] **8.4 — Team lore.** Cross-persona shared namespace; ceremony outputs (retro decisions, review write-ups) land here.
- [ ] **8.5 — Read-the-room guard, full version.** Extends the minimal situational-appropriateness gate shipped at 3.4a-iii (and consumed by 7.2a) to every standing-proactive surface — interjections, stall pings, all ceremony and ambient actions (VISION §9's Viktor lesson). Small classifier-style gate, own chunk so it's testable.
      **Archived notes for this chunk:** §3.4a-iii in `docs/history/BUILD-NARRATIVE.md`.

---

## Deliberately not scheduled (parked, with re-entry conditions)

- **Multi-project support** (team.config.ts, cross-project Kanban, onboarding flows) — re-enter when a second real project is actually ready to join (VISION §3.4).
- **SOTA quality additions** (mutation testing, prompt-injection fixtures, extended-thinking review) — re-enter after Stage 0's spine has been running for a few stages (VISION §12's deferral, pending Alex's confirm/override).
- **Interjection-bar mechanism** (unprompted persona observations à la Marcus in VISION §1.3) — re-enter during/after Stage 6, once there's real channel traffic to calibrate against. Until then personas speak when spoken to, in ceremonies, or per intake.
- **Disagreement-escalation chain code** (VISION §9) — re-enter when a real persistent disagreement is observed in practice; the prompt-side pushback half is covered by 5.3's Appendix-C layering.
- **Chief-clancy doc ports** (LIFECYCLE.md, VISUAL-ARCHITECTURE.md) — re-enter once moe has real personas and a working ticket pipeline to describe/diagram (Stage 4+). **`docs/guides/`** — re-enter once moe ships an installable/configurable deployed surface. **`docs/roles/`** — re-enter once moe's own personas exist past scaffold, adopting its one-file-per-role convention. **TECHNICAL-REFERENCE.md, COMPARISON.md** — no near-term moe equivalent, no specific re-entry trigger. Decided at chunk 0.6c; see `docs/decisions/CHIEF-CLANCY-DOC-PORTS.md`.
- **`docs/INDEX.md`** — re-enter once enough real PRs exist to route against (Stage 1–2 territory).
- **Per-persona learning windows / self-development** (VISION §7's continuous-learning facet) — re-enter after Stage 8 lands and memory is stable.
