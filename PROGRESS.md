# Progress

Living state document — current state, what's next. Session-by-session detail lives in git history once entries archive out (see `docs/history/SESSIONS.md` and `docs/DEVELOPMENT.md` §Session handoff for the mechanics).

## Next workstreams (after Session 1)

Updated 2026-07-04 end-Session-1 — **first working session of the moe v3 ground-up rebuild: repo bootstrap through Stage-0 process docs.** Alex asked to begin BUILD_PLAN chunk 0.1 and work through Stage 0 chunk by chunk, stopping at `[GATE]` chunks.

**Stage 0, chunks 0.1–0.5:** all merged. `git init` + pnpm workspace skeleton (direct-to-main bootstrap commit — no PR yet, no remote existed) → ESLint/Prettier/knip/husky ([#1](https://github.com/Pushedskydiver/moe/pull/1)) → repo settings + branch-cleanup convention ([#2](https://github.com/Pushedskydiver/moe/pull/2)) → settled package graph + `eslint-plugin-boundaries` ([#3](https://github.com/Pushedskydiver/moe/pull/3)) → CI pipeline + branch protection ([#4](https://github.com/Pushedskydiver/moe/pull/4)) → review-gate agents ported ([#5](https://github.com/Pushedskydiver/moe/pull/5)). Repo is live and public at `Pushedskydiver/moe`.

**Chunk 0.6a (process docs):** merged ([#6](https://github.com/Pushedskydiver/moe/pull/6)). `docs/DEVELOPMENT.md` + `docs/TESTING.md` added, adapted from chief-clancy's own versions. Resolved `CLAUDE.md`'s open question about moe's own `PROGRESS.md`/`docs/history/SESSIONS.md` equivalent (this file) — same names, same shapes as chief-clancy's, scaled down since moe has no session history yet. Dogfooded via a workflow (DA + `copilot-surrogate` in parallel) — caught 3 real findings each, including a genuine miss: an earlier "marking 0.5 merged" never actually flipped the checkbox.

**Chunk 0.6b (review canon) — in flight this session:** `docs/RATIONALIZATIONS.md` + `docs/REVIEW-PATTERNS.md`, the latter pre-seeded per `docs/VISION.md` §12's five named failure classes (persona-prompt drift, ESM `.js` extension slips, schema/type separation, business-hours guard misses, recorded-transcript drift) — several describe functionality that doesn't exist yet (Stage 2/5 chunks), seeded ahead of any real catch by design.

**Major novel patterns Session 1:**

1. **Volta/pnpm Node-24 gotcha (n=1, hit every session so far)** — `nvm use 24` alone does not fix `ERR_PNPM_UNSUPPORTED_ENGINE`; a Volta shim wins on `PATH` even after pinning both `volta.node` and `volta.pnpm` in `package.json`. Fix: prepend nvm's v24 bin dir to `PATH` explicitly, in the same shell invocation as the pnpm command (Bash tool shell state doesn't persist between calls).
2. **Fixture-testing catches silently-inert config (n=2)** — chunk 0.2's rule-family fixtures and chunk 0.3's boundaries-rule fixture both caught config that loaded without error but didn't actually fire (a missing `n/no-path-concat` global-scope wiring resolved by testing `import.meta.dirname` instead of `__dirname`; `eslint-plugin-boundaries` needing `eslint-import-resolver-typescript` to resolve NodeNext-style relative imports at all). Writing the fixture and watching it fail to fail is the only thing that caught either.
3. **CLAUDE.md's own status framing drifted for 3 chunks before being caught** — a `copilot-surrogate` pass on chunk 0.5 (dispatched because that PR had a `fix(docs)` commit) found `CLAUDE.md` still said the package graph was "not yet settled" and the review-agent subagents "don't exist yet," both false as of PRs #3 and #5 respectively. Nobody had been truing up `CLAUDE.md`'s status paragraph incrementally. Fixed, and flagged as a standing habit: check it every chunk, not just when a review agent happens to catch it.
4. **Newly-created `.claude/agents/*.md` aren't dynamically dispatchable the same session they're written** — first attempt to invoke `da-review` right after creating it failed with "Agent type not found." Worked around with a `general-purpose` agent carrying the target's own instructions; the real agent type became available later in the same session (exact trigger unclear).
5. **Repo settings needed fixing after PR #1**, not just documenting — GitHub allowed merge-commit and rebase merges by default, so PR #1 landed as a merge commit despite `docs/GIT.md` requiring squash-only. Fixed via `gh api` (squash-only, `delete_branch_on_merge`, bare-PR-title squash message) before PR #2, which then landed clean.
6. **Saying "I'll fix that" isn't the same as fixing it (n=1, this session's own DA pass caught it on itself)** — earlier this session, chunk 0.5's BUILD_PLAN checkbox was flagged for a flip to `[x]` in a status update, but the actual `Edit` call never happened. A DA review dispatched on chunk 0.6a's own diff caught the stale `[~]`, plus the downstream `CLAUDE.md` kept-prose that had quietly inherited the same inconsistency ("live as of chunk 0.5" next to a checkbox still reading in-progress). Both fixed in the same round. The lesson isn't "check BUILD_PLAN more carefully" — it's that a stated intention needs the same verification pass as any other claim before treating it as done.

### Next session loading instructions

- **Verify state before picking anything up:** confirm chunk 0.6b's PR actually merged (`gh pr view <n> --json state,mergedAt`), then `git checkout main && git pull && git branch -d chore/review-canon`.
- **Primary workstream:** BUILD_PLAN chunk 0.6c — reference docs + port decision (`docs/ARCHITECTURE.md`, `docs/GLOSSARY.md`, `docs/decisions/` with README; also decide which of chief-clancy's other docs moe ports, per `CLAUDE.md`'s parked list).
- **Decision branches:**
  - A. If Alex has feedback on the `PROGRESS.md`/`SESSIONS.md` naming or structure, or on `docs/RATIONALIZATIONS.md`/`docs/REVIEW-PATTERNS.md`'s content, apply it before continuing the pattern into future chunks.
  - B. 0.7 (the `generate:agents-md` script port + CI freshness check) remains after 0.6c. Neither is `[GATE]`.
- **Carry-overs:**
  - Branch protection on `main` requires "Quality suite" + "Validate PR title format"; `enforce_admins: false` (deliberate escape hatch, not routine bypass).
  - Merge is squash-only, `delete_branch_on_merge` on — confirmed working correctly since PR #2.
  - Always re-derive the Node-24 `PATH` prepend in every Bash call that needs it; it does not persist across calls.
  - Direct-to-main pushes get blocked by the harness's own auto-mode classifier even for changes GIT.md's rules would permit (a small checkbox-only fix was blocked this session) — route even small doc fixes through a branch/PR, or bundle them into whatever branch is already open.
  - First `[GATE]` chunk is 1.2a (topology × DB) — still several chunks away, no action needed yet.
- **Fallback:** if Alex redirects on load, follow that; otherwise default to 0.6c.

## Session archive

Archived sessions are in `docs/history/SESSIONS.md`. Full retrospective for any session survives in `git log -p PROGRESS.md` at that session's compression commit.

## Phase ledger

| Chunk | Status      | Shipped    | Headline                                                                                       |
| ----- | ----------- | ---------- | ---------------------------------------------------------------------------------------------- |
| 0.1   | Merged      | 2026-07-04 | git init + pnpm workspace skeleton, `packages/core` toolchain proven                           |
| 0.2   | Merged      | 2026-07-04 | ESLint/Prettier/knip/husky, 6 rule-family fixtures verified then deleted                       |
| 0.3   | Merged      | 2026-07-04 | Package graph settled, `eslint-plugin-boundaries` wired (needed a resolver fix)                |
| 0.4   | Merged      | 2026-07-04 | CI pipeline + branch protection live                                                           |
| 0.5   | Merged      | 2026-07-04 | Review-gate agents ported, dogfooded, caught real `CLAUDE.md` drift                            |
| 0.6a  | Merged      | 2026-07-04 | Process docs (`docs/DEVELOPMENT.md`, `docs/TESTING.md`) + `PROGRESS.md`/`SESSIONS.md` resolved |
| 0.6b  | In progress | —          | Review canon (`docs/RATIONALIZATIONS.md`, `docs/REVIEW-PATTERNS.md` pre-seeded per VISION §12) |
