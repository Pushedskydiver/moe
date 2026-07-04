# Git Conventions

Adapted from chief-clancy's own `docs/GIT.md`. Commit format and the gitmoji table carry over unchanged — this is universal convention with no moe-specific reason to diverge. Branch strategy carries over with one delta (branch naming, below). What else changes: there's no npm publish/changesets flow (moe doesn't publish packages), replaced with a deploy flow; and the blast-radius doc list reflects moe's own policy docs.

## Branch Strategy

```
main ← feature/ | fix/ | chore/ | refactor/ | docs/
```

All work branches from `main` and merges back to `main` via PR.

| Branch            | Purpose                              | Branched from | Merges into |
| ----------------- | ------------------------------------ | ------------- | ----------- |
| `main`            | Production code, tagged releases     | —             | —           |
| `feature/<name>`  | New features                         | `main`        | `main`      |
| `fix/<name>`      | Bug fixes                            | `main`        | `main`      |
| `chore/<name>`    | Maintenance, deps, config            | `main`        | `main`      |
| `refactor/<name>` | Code restructuring, no new behaviour | `main`        | `main`      |
| `docs/<name>`     | Documentation only                   | `main`        | `main`      |

### Rules

- **If it runs, it needs a PR.** TypeScript (`packages/*/src/`, `apps/*/src/`), tests, executable markdown, package.json, CI config (`.github/`) — always via branch + PR.
- **If it's only read by humans/agents for context, direct to main is fine — but only when no branch/PR is open.** Non-blast-radius docs, README badge/link fixes, typo corrections, and `fix(docs)` drift-fix commits meeting the predicate below. If you have an open feature branch, commit doc changes there instead. **This does not include blast-radius docs** (below) — those go through the PR flow regardless of how small or context-only the edit is; predicate #5 below exists specifically to exclude them.

**What is "executable markdown"?** Markdown that Claude or Codex executes as instructions rather than reads as background context — persona prompt files (`packages/agents/src/personas/*/prompt.md`) and any slash-command/skill/workflow markdown under `.claude/` or `.codex/` that an agent runs. A change here changes behavior the same way a code change does, so it goes through the PR flow like code — never the direct-to-main docs exception.

**`fix(docs)` drift-fix predicate — all five must hold:**

1. **No branch/PR open.** Same precondition as rule #2 above — if you have an open feature branch, commit the drift-fix there instead.
2. **Not executable markdown.** Persona prompt files (`packages/agents/src/personas/*/prompt.md`) and any workflow/command markdown Claude executes as instructions are excluded — use the PR flow.
3. **Grep-falsifiable drift.** The edit corrects a claim provable false by `grep`/`read` against code or another on-disk ground-truth source. Doesn't apply to taste changes or rule-body rewrites — those need PR review regardless of size.
4. **Low-LOC.** LOC touched ≤ 50 across all files in the commit.
5. **Not on the blast-radius list** below. Drift-fixes on those docs go through the PR flow (Alex-merge).

When any predicate fails, use the PR flow.

- **Delete branches after merging.** The remote branch is deleted automatically (`delete_branch_on_merge`, see Merge Strategy below) — that half needs no action. The **local** clone's branch is not touched by GitHub and does not auto-delete: after confirming a PR merged (`gh pr view <n> --json state,mergedAt`), `git checkout main && git pull`, then `git branch -d <branch>` before starting the next chunk. Claude/Codex do this as a matter of course, not just Alex.
- **CI must pass before merging.** Enforced via branch protection on `main`: `.github/workflows/ci.yml`'s "Quality suite" job and `.github/workflows/pr-title-check.yml`'s "Validate PR title format" job are both required status checks. Admin/owner enforcement is off (`enforce_admins: false`) — a deliberate one-person-team escape hatch for genuine emergencies, not an invitation to routinely bypass the gate.

## Branch Naming

```
type/short-description
```

Types: `feature`, `fix`, `chore`, `refactor`, `docs`. `refactor/` and `docs/` branches use the `chore` label.

Examples:

```
feature/evidence-gated-claims
fix/slack-rate-limit-tier-lookup
chore/update-dependencies
refactor/extract-risk-classifier
docs/build-plan-chunk-0
```

Keep names short and descriptive. No ticket numbers — moe's own development doesn't run through an external board either; it tracks against `BUILD_PLAN.md` chunks. (This is distinct from the Slack↔GitHub ticket/board system moe-the-product operates for chief-clancy per `docs/VISION.md` §7.6 — that governs chief-clancy's repo, not this one.)

## Commit Messages

Format:

```
<gitmoji> <type>(scope): description
```

The gitmoji comes first, then the conventional commit type. Scope is optional.

### Types

| Type       | Gitmoji | Use for                                |
| ---------- | ------- | -------------------------------------- |
| `feat`     | ✨      | New feature                            |
| `fix`      | 🐛      | Bug fix                                |
| `chore`    | 📦      | Maintenance, deps, config              |
| `refactor` | ♻️      | Code change that doesn't fix or add    |
| `test`     | ✅      | Adding or updating tests               |
| `docs`     | 📝      | Documentation only                     |
| `style`    | 💄      | Formatting, cosmetic (no logic change) |
| `perf`     | ⚡️      | Performance improvement                |
| `security` | 🔒      | Security fix                           |
| `remove`   | 🔥      | Removing code or files                 |
| `build`    | 🔧      | Build system, dependency bumps         |

### Examples

```
✨ feat: add evidence-gated claim schema
🐛 fix: correct Slack rate-limit tier lookup
📝 docs: add BUILD_PLAN chunk 0
💄 style: apply prettier import ordering
✅ test: add risk-tier classifier property tests
♻️ refactor: extract claim validator as pure function
📦 chore: scaffold monorepo with pnpm workspaces
```

### No `--amend`

Always create a new commit instead of amending an existing one, even for small follow-up fixes. Never use `git commit --amend`. Pre-commit hook failures: fix the issue, re-stage, create a NEW commit.

## Labels

### PR labels (required — one per PR)

Every PR must have exactly one type label. `refactor/` and `docs/` branches use the `chore` label:

| Label     | Branch prefix                  |
| --------- | ------------------------------ |
| `feature` | `feature/`                     |
| `fix`     | `fix/`                         |
| `chore`   | `chore/`, `refactor/`, `docs/` |

### Package scope labels

**Settled at `BUILD_PLAN.md` chunk 0.3** — matches the confirmed package graph in `docs/CONVENTIONS.md`'s Architecture Enforcement section:

| Label    | When to use                   |
| -------- | ----------------------------- |
| `core`   | Changes to `packages/core/`   |
| `memory` | Changes to `packages/memory/` |
| `agents` | Changes to `packages/agents/` |
| `slack`  | Changes to `packages/slack/`  |
| `github` | Changes to `packages/github/` |
| `server` | Changes to `apps/server/`     |

PRs touching multiple packages get multiple labels. Root-only changes (CI, docs, config) get no scope label.

### Rules

- **Do not create ad-hoc labels.** If a new label is needed, discuss first and add it to this list.
- **One type label per PR.**
- **Scope labels are additive.**

## Merge Strategy

- Feature/fix/chore branches: **squash merge** into `main`.
- **PR title = squash commit message** — must follow the gitmoji + conventional commit format above.
- The PR title becomes the single commit message on `main`.
- **Enforced at the repo level**, not just by convention: merge commits and rebase merges are disabled in GitHub repo settings — squash is the only merge button available. `squash_merge_commit_title` is `PR_TITLE` and `squash_merge_commit_message` is `BLANK`, so the squash commit is exactly the PR title, nothing appended. `delete_branch_on_merge` is on, so the remote branch is deleted automatically the moment a PR merges.

## Deploy Flow

**Delta from chief-clancy: no npm publish, no changesets.** Moe doesn't distribute packages — `apps/server` is a privately-deployed service (Fly.io), not a published tool. Deploys are deliberately manual, never CI-automated on merge:

1. Merge to `main` via the normal PR flow above.
2. Alex runs `fly deploy --app moe` by hand.
3. Confirm the health check passes before considering the deploy done.

This is a deliberate safety choice, not a placeholder — a prior truncated/empty secret took the live service down when deploy was more automated (see project history). Revisit only with a concrete plan for how a bad deploy gets caught before it reaches production.

## Blast-Radius Docs (Alex-merge, not auto-mergeable)

Editing any of these triggers Alex-review regardless of how small the diff is:

- `CLAUDE.md`, `AGENTS.md`
- `docs/VISION.md`, `docs/CEREMONIES.md`, `docs/PERSONAS.md` (once written)
- `docs/CONVENTIONS.md`, `docs/GIT.md`
- `docs/DEVELOPMENT.md`, `docs/DA-REVIEW.md`, `docs/SELF-REVIEW.md`, `docs/TESTING.md`, `docs/RATIONALIZATIONS.md` (once written)
- `packages/agents/src/personas/*/prompt.md` — the do-not-touch list from `CLAUDE.md`
- `/.github/workflows/**`, `/.github/CODEOWNERS`
- Repo-root config: `/package.json`, `/pnpm-workspace.yaml`, `/pnpm-lock.yaml`, `/tsconfig.base.json`, `/tsconfig.json`, `/eslint.config.ts`, `/knip.json`

This list is the source of truth — re-check it rather than recite from memory, same discipline chief-clancy applies to its own list.
