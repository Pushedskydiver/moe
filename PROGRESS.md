# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 3)

Updated 2026-07-15 end-Session-3 — **Stage 1 shipped in full, plus chunk 2.1 (Stage 2's cast-redline gate).** One long continuous session that picked up exactly where Session 2's loading instructions left off (chunk 1.1) and ran through chunk 2.1 with no handoff in between, across two real calendar days (2026-07-10/11, then 2026-07-15) — this entry is written retroactively at Alex's prompt, since `CLAUDE.md`'s own phase-boundary handoff trigger fired repeatedly (every merged PR) and wasn't acted on.

**Chunk 1.1 — Ticket types + Zod schemas**: [PR #12](https://github.com/Pushedskydiver/moe/pull/12), merged.

**Chunk 1.2a — [GATE] Process topology × DB ADR**: [PR #13](https://github.com/Pushedskydiver/moe/pull/13), merged — a deep-research pass (109 claims, adversarially verified) reversed the original single-machine+SQLite framing to N machines + Neon Postgres, on evidence (Litestream's ongoing silent-failure bug pattern, real Fly incident cadence, a narrower cost gap than assumed once Neon replaces Fly Managed Postgres as the comparison). `docs/decisions/TOPOLOGY-AND-DATABASE.md`.

**Chunk 1.2b — Database layer + tickets table**: [PR #14](https://github.com/Pushedskydiver/moe/pull/14), merged — Kysely + pg against Neon, flat-SQL migration runner (`pg_advisory_xact_lock`, transaction-scoped so it's safe under PgBouncer transaction-mode pooling), plain CRUD validated through `ticketSchema`. Review gate caught `createTicket`/`updateTicket` validating rows only _after_ writing them (a real data-integrity gap — fixed to validate-before-write) plus a Node-native-TS `.js`→`.ts` resolution gotcha that broke `pnpm lint` on a fresh checkout (fixed by making scripts consume built `dist/` output, `pnpm build` now first in the pre-push suite; documented for real at `docs/DEVELOPMENT.md` §Node-native TS execution and local imports).

**Side-fix — branch-prefix drift**: [PR #15](https://github.com/Pushedskydiver/moe/pull/15) — `docs/GIT.md` documented the branch prefix as `feature/`; all 14 PRs to date had actually used `feat/`. Fixed the doc to match reality, not the other way around.

**Chunk 1.3 — Atomic claim**: [PR #16](https://github.com/Pushedskydiver/moe/pull/16), merged — compare-and-set claim/release via `WHERE claimedBy IS NULL`/`WHERE claimedBy = <caller>`, concurrency-tested directly (10 racing claimants against one ticket, exactly one winner, version increments exactly once). Review gate fixed a chained-method-count convention violation and strengthened the atomicity TSDoc to name the actual Postgres mechanism (READ COMMITTED + row-lock/EvalPlanQual re-check) instead of just asserting the conclusion.

**Chunk 1.4 — StatusClaim schema + composer gate**: [PR #17](https://github.com/Pushedskydiver/moe/pull/17), merged — VISION §7.6's anti-fabrication fix: `composeStatus` refuses to emit a claim missing `toolCallId`/`toolOutputSnippet`, falling back to `{ kind: 'not-yet-verified' }`. Review gate caught `StatusClaimCandidate` as a hand-maintained type with no structural link to the schema (a real schema/type-drift risk) — now derived via `Omit<StatusClaim, ...>`.

**Chunk 1.5 — [GATE] Track-record definition ADR**: [PR #18](https://github.com/Pushedskydiver/moe/pull/18), merged — four discrete policy calls made directly with Alex (minimum track record across a multi-directory diff, preserve on git-detected rename, no transfer to a brand-new directory, threshold **N = 5**), not a research question this time. `docs/decisions/TRACK-RECORD-DEFINITION.md`. Review gate's proactive cross-doc sweep found the resolution left five other files (`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md` ×2, `docs/GLOSSARY.md`) still asserting the question was open — all fixed in the same PR.

**Side-fix — VISION §13.1.1 citation**: [PR #19](https://github.com/Pushedskydiver/moe/pull/19) — `BUILD_PLAN.md` cited a `VISION.md` §13.1.1 subsection that doesn't exist (§13.1 is a plain numbered list). Fixed both occurrences to cite the list item directly.

**Chunk 1.6 — Risk-tier classifier**: [PR #20](https://github.com/Pushedskydiver/moe/pull/20), merged — `classifyRiskTier(diffMeta)` implementing VISION §8.1's tier table + the 1.5 ADR. Property-based tests (fast-check) caught two real bugs pre-review: the Tier-1 gate never checked `isLogicChange`, and the Tier-0 gate didn't account for `crossesPackageBoundary`. Review gate then found a **third** real gap the property tests wouldn't have caught either — a collapsed `isLogicChange` boolean couldn't represent VISION's major-vs-non-major-devDependency-bump distinction, so a major bump could have silently auto-merged. Split into two independent fields; the property-test suite itself was strengthened with two new invariants that would catch both original bug classes directly, not just the one each happened to cover. **Stage 1 complete.**

**Chunk 2.1 — [GATE] Cast redline conversation**: [PR #21](https://github.com/Pushedskydiver/moe/pull/21), merged — kept the previous 7-role roster as-is, confirmed Sarah as first/front-door persona, deferred the 8th role (Designer) to the 5.0 gate, via a 105-sub-agent deep-research pass. `docs/decisions/CAST-ROSTER.md`. **Review gate (two rounds) caught a fabricated statistic** — "18% fewer errors caught" — that the deep-research workflow's own "confirmed" adversarial-vote had let through, attached to a real BCG/HBR citation; independently re-verified directly against the source article, which states the finding only directionally, no percentage. A fresh R2 pass then caught a smaller residual slip in the same fix (the source's "%" comparison had been reworded to "points," a different statistical claim). Also resolved a `BUILD_PLAN.md` "Open question (settle at 2.1)" about Stage 4-vs-5 ordering that the original pass had missed entirely — brought back to Alex directly; kept the current ordering (Stages 2-4 proven on Sarah alone, full cast at Stage 5).

**Major novel patterns this session:**

1. **A deep-research workflow's own adversarial verification can pass a fabricated number.** The chunk 1.2a topology/DB research came back clean; the chunk 2.1 cast-roster research didn't — a "confirmed" vote isn't a guarantee against hallucination. Spot-check any specific statistic against its primary source before it lands in a permanent decision doc. New memory: `deep-research-numeric-claims-need-spot-check`.
2. **R2 verification earns its keep, again.** Both times a review round found something BLOCKING/MATERIAL this session (1.2b's data-integrity gap, 2.1's fabricated stat), the _fix itself_ needed a second, independent look before merge — R2 caught a real residual issue in the 2.1 fix (the %-vs-points slip) that self-review alone had missed.
3. **Forgot to branch after syncing `main`, once.** Caught before pushing (nothing had been pushed yet), fixed cleanly by moving the commit to a new branch and resetting local `main`. Updated the existing `branch-from-develop-after-escalated` memory to cover this broader failure class — branch first, unconditionally, not "after remembering to."
4. **Handoff should have fired earlier, not waited for a prompt.** Six chunks plus two side-fixes shipped in one continuous session with zero handoffs in between, despite `CLAUDE.md`'s own trigger ("a natural phase boundary — a PR merged, a chunk shipped") firing on every single merge. Treat every merged PR as a real trigger-evaluation moment going forward, not just a context-size threshold to wait out.

**Earlier Session 2 status, compressed** — deep-research test of chief-clancy's auto-handoff conclusion (decline-with-updated-reasons position adopted, `docs/DEVELOPMENT.md` §Session handoff), then chunks 0.6c (reference docs + doc-port decision) and 0.7 (generate:agents-md TS port + CI freshness check), closing Stage 0 entirely. [#9](https://github.com/Pushedskydiver/moe/pull/9)–[#11](https://github.com/Pushedskydiver/moe/pull/11).

**Earlier Session 1 status, compressed** — first working session of the v3 rebuild: repo bootstrap through Stage-0 process docs, chunks 0.1–0.6b shipped 2026-07-04–07-09 ([#1](https://github.com/Pushedskydiver/moe/pull/1)–[#8](https://github.com/Pushedskydiver/moe/pull/8)). Durable patterns: Volta/pnpm Node-24 PATH gotcha (documented for real, no longer memory-only); fixture-testing catches silently-inert config; a stated intention needs the same verification as any other claim.

### Session 4 loading instructions

- **Verify state before picking anything up:** `git log --oneline -5` (expect PR #21's squash `ec641d3` at HEAD), `git status` clean on `main`. `BUILD_PLAN.md` shows Stage 1 (`1.1`–`1.6`) fully `[x]` and `2.1` at `[~]` — 2.1 is merged and content-complete (PR #21), but per this project's own established precedent, its flip to `[x]` is chunk 2.2's own first edit, not something already done.
- **Primary workstream — BUILD_PLAN Stage 2, chunk 2.2:** "Persona process skeleton." `apps/server` boots, loads a persona config (ID, Slack credentials), connects nothing, health-check endpoint, structured logging with secret redaction. Deployable to Fly as one machine. Not `[GATE]`. Flip `2.1`→`[x]` as this PR's first edit (verify PR #21's actual content on `main` first, don't trust this note alone). Same rules of engagement as every prior chunk: one chunk = one PR, full review gate (DA + copilot-surrogate, dispatch with `isolation: 'worktree'`), docs win on conflict, surface contradictions, R2-verify after any BLOCKING/MATERIAL finding, and treat the PR merge itself as a handoff-trigger evaluation point.
- **Decision branches:**
  - A. Chunk 2.3 (Slack app + inbound events) will need a real Slack App created for Sarah before it can be built — this may require Alex's own action outside the repo (app creation in Slack's admin console, credential retrieval). Flag this explicitly as 2.2 nears completion rather than discovering it mid-2.3.
  - B. Stage 2's exit criterion (one persona on Fly, her own Slack App, responds to a DM, every status statement carries §7.6 evidence) isn't met until 2.4a/2.4b land — 2.2/2.3/2.4a/2.4b are the load-bearing sequence for this stage, don't skip ahead.
  - C. If a research-backed decision comes up again (matching 1.2a/1.5/2.1's pattern), independently spot-check any specific statistic before it lands in a permanent doc — see the `deep-research-numeric-claims-need-spot-check` memory.
- **Carry-overs:**
  - `docs/decisions/` now holds four ADRs: `SESSION-HANDOFF-AUTOMATION.md`, `TOPOLOGY-AND-DATABASE.md`, `TRACK-RECORD-DEFINITION.md`, `CAST-ROSTER.md`. None have been trimmed to the ~50-line "decisions-only" post-shipping budget yet (`docs/decisions/README.md`'s own lifecycle step 3) — a pre-existing, not-yet-urgent gap, flagged twice in review gates so far without being acted on.
  - `docs/PERSONAS.md` now exists (skeleton only) — its roster table mirrors VISION §4.1 under the same do-not-touch protection; don't edit one without the other.
  - The cast is settled: Sarah/PM, Marcus/Architect, Riley/Engineer, Priya/QA, Dom/Reviewer, Theo/Researcher, Nia/Scrum Master. Designer deferred to the 5.0 gate — a working name "Maya" already sits in `BUILD_PLAN.md`'s parked list, informal/unreconciled until the role actually activates.
  - Branch discipline: create the dedicated branch as the literal first action after syncing `main`, before any edit, every single chunk transition.
  - Node-24 `PATH` prepend still needed in every Bash call that runs pnpm (`docs/DEVELOPMENT.md` §Local dev environment). `pnpm build` now runs first in the pre-push suite (see chunk 1.2b above) — don't drop it when running the suite manually.
- **Fallback:** if Alex redirects on load, follow that; otherwise default to the primary workstream above.

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

| Chunk | Status | Shipped    | Headline                                                                                            |
| ----- | ------ | ---------- | --------------------------------------------------------------------------------------------------- |
| 0.1   | Merged | 2026-07-04 | git init + pnpm workspace skeleton, `packages/core` toolchain proven                                |
| 0.2   | Merged | 2026-07-04 | ESLint/Prettier/knip/husky, 6 rule-family fixtures verified then deleted                            |
| 0.3   | Merged | 2026-07-04 | Package graph settled, `eslint-plugin-boundaries` wired (needed a resolver fix)                     |
| 0.4   | Merged | 2026-07-04 | CI pipeline + branch protection live                                                                |
| 0.5   | Merged | 2026-07-04 | Review-gate agents ported, dogfooded, caught real `CLAUDE.md` drift                                 |
| 0.6a  | Merged | 2026-07-04 | Process docs (`docs/DEVELOPMENT.md`, `docs/TESTING.md`) + `PROGRESS.md`/`SESSIONS.md` resolved      |
| 0.6b  | Merged | 2026-07-09 | Review canon (`docs/RATIONALIZATIONS.md`, `docs/REVIEW-PATTERNS.md` pre-seeded per VISION §12)      |
| 0.6c  | Merged | 2026-07-10 | Reference docs (`ARCHITECTURE.md`, `GLOSSARY.md`, `decisions/`) + chief-clancy doc-port decision    |
| 0.7   | Merged | 2026-07-10 | `generate:agents-md` TS port + CI freshness check (now required) — **Stage 0 complete**             |
| 1.1   | Merged | 2026-07-10 | Ticket types + Zod schemas — pure domain model, no DB yet                                           |
| 1.2a  | Merged | 2026-07-11 | [GATE] Process topology × DB ADR — N machines, Neon Postgres (`TOPOLOGY-AND-DATABASE.md`)           |
| 1.2b  | Merged | 2026-07-11 | Database layer + tickets table (Kysely + pg, flat-SQL migrations, plain CRUD)                       |
| 1.3   | Merged | 2026-07-11 | Atomic claim — compare-and-set via `WHERE claimedBy IS NULL`, concurrency-tested                    |
| 1.4   | Merged | 2026-07-11 | StatusClaim schema + composer gate — VISION §7.6's anti-fabrication fix                             |
| 1.5   | Merged | 2026-07-11 | [GATE] Track-record definition ADR — N=5, minimum-across-directories (`TRACK-RECORD-DEFINITION.md`) |
| 1.6   | Merged | 2026-07-15 | Risk-tier classifier (`classifyRiskTier`, VISION §8.1 + the 1.5 ADR) — **Stage 1 complete**         |
| 2.1   | Merged | 2026-07-15 | [GATE] Cast redline — 7-role roster kept, Sarah first, Designer deferred (`CAST-ROSTER.md`)         |
