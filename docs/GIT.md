# Git Conventions

Adapted from chief-clancy's own `docs/GIT.md`. Commit format and the gitmoji table carry over unchanged — this is universal convention with no moe-specific reason to diverge. Branch strategy carries over with one delta (branch naming, below). What else changes: there's no npm publish/changesets flow (moe doesn't publish packages), replaced with a deploy flow; and the blast-radius doc list reflects moe's own policy docs.

## Branch Strategy

```
main ← feat/ | fix/ | chore/ | refactor/ | docs/
```

All work branches from `main` and merges back to `main` via PR.

| Branch            | Purpose                              | Branched from | Merges into |
| ----------------- | ------------------------------------ | ------------- | ----------- |
| `main`            | Production code, tagged releases     | —             | —           |
| `feat/<name>`     | New features                         | `main`        | `main`      |
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

- **Create the dedicated branch as the literal first action after syncing `main`, before any edit — every single chunk/fix transition.** Not a one-time habit to remember, a step to redo explicitly each time: `git checkout main && git pull`, then `git checkout -b <next-slice>`, before touching any file. Two confirmed failure modes from skipping this: (1) after an _escalated_ (opened but not yet merged) PR, cutting the next branch without returning to `main` first stacks the un-merged commit underneath the new branch, so the new PR's diff wrongly includes both changes; (2) after a normal merge+sync, committing the next chunk's work directly onto local `main` because the branch-creation step was skipped entirely, not just misordered. Both have recurred multiple times across this project's history — the fix if it already happened: `git rebase --onto main <bad-base-branch> <slice-branch>` for case 1, or `git branch <name> <bad-commit>` followed by `git reset --hard origin/main` for case 2, then re-verify the full quality suite.
- **Delete branches after merging.** The remote branch is deleted automatically (`delete_branch_on_merge`, see Merge Strategy below) — that half needs no action. The **local** clone's branch is not touched by GitHub and does not auto-delete: after confirming a PR merged (`gh pr view <n> --json state,mergedAt`), `git checkout main && git pull`, then `git branch -d <branch>` before starting the next chunk. Claude/Codex do this as a matter of course, not just Alex.
- **CI must pass before merging.** Enforced via branch protection on `main`: `.github/workflows/ci.yml`'s "Quality suite" job and `.github/workflows/pr-title-check.yml`'s "Validate PR title format" job are both required status checks. Admin/owner enforcement is off (`enforce_admins: false`) — a deliberate one-person-team escape hatch for genuine emergencies, not an invitation to routinely bypass the gate.

## Branch Naming

```
type/short-description
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`. `refactor/` and `docs/` branches use the `chore` label.

Examples:

```
feat/evidence-gated-claims
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

**Nothing checks the gitmoji/type/scope format locally — `.husky/pre-commit` only runs `lint-staged` (eslint/prettier on staged files), no commit-msg hook.** The PR title — not any individual commit message — is what CI's "Validate PR title format" job actually enforces, and it becomes the squash-merge subject. A title that "looks right" and was never rejected by anything local can still fail CI. Three confirmed failure shapes on an otherwise well-formed title:

1. **Wrong gitmoji for the type** (e.g. `🔧` — build's emoji — paired with `chore`'s type).
2. **The wrong Unicode form of the emoji** — most types use the bare codepoint (e.g. `🔒` U+1F512 alone, no trailing selector), but `refactor` (`♻️`) and `perf` (`⚡️`) canonically include a trailing U+FE0F variation selector and the CI check's own `ALLOWED_PREFIXES` array (`.github/workflows/pr-title-check.yml`) expects it present for those two — the direction of "which form is correct" is per-emoji, not a single rule. Copy the exact character sequence from the Types table above or the CI failure output rather than hand-typing one.
3. **Punctuation in the scope** — the scope regex is `[a-zA-Z0-9_-]+`: a literal dot (e.g. `chunk-0.6c`) or a comma-joined multi-package list (e.g. `(core,agents,server)`) both fail, since it's a single group, not a list. Use a package name as the scope (`core`, `agents`, `server`, `slack`, `progress`) — not a BUILD_PLAN chunk identifier, dash-separated or not — and put any chunk/stage reference in the description text instead (e.g. `feat(server): add Stage-1 classifier gate, DMs-only chat replies`).

If the title check fails, read the CI failure output for the exact "got" vs. expected format rather than guessing, and fix with `gh pr edit <n> --title "..."` — no re-commit needed, since squash-merge takes the PR title, not the branch's own commit messages.

### No `--amend`

Always create a new commit instead of amending an existing one, even for small follow-up fixes. Never use `git commit --amend`. Pre-commit hook failures: fix the issue, re-stage, create a NEW commit.

## Labels

### PR labels (required — one per PR)

Every PR must have exactly one type label. `refactor/` and `docs/` branches use the `chore` label:

| Label     | Branch prefix                  |
| --------- | ------------------------------ |
| `feature` | `feat/`                        |
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
- **One type label per PR** — see Merge Strategy below for why splitting a bundled change into multiple commits on one branch doesn't satisfy this.
- **Scope labels are additive.**

## Merge Strategy

- Feature/fix/chore branches: **squash merge** into `main`.
- **PR title = squash commit message** — must follow the gitmoji + conventional commit format above.
- The PR title becomes the single commit message on `main`.
- **Enforced at the repo level**, not just by convention: merge commits and rebase merges are disabled in GitHub repo settings — squash is the only merge button available. `squash_merge_commit_title` is `PR_TITLE` and `squash_merge_commit_message` is `BLANK`, so the squash commit is exactly the PR title, nothing appended. `delete_branch_on_merge` is on, so the remote branch is deleted automatically the moment a PR merges.
- **Two unrelated changes need two separate PRs, not two commits bundled into one PR.** Because squash-merge collapses a branch's entire commit history down to the PR title alone, splitting a bundled diff into multiple well-typed _commits_ on the same branch does not satisfy Labels' "one type label per PR" rule if those commits still land in a single PR — the PR, not the commit, is the real unit this rule applies to. Whichever commit's own subject isn't chosen as the PR title never lands in `main`'s own `git log`/`blame` — it's still visible on the merged PR's own commit-list view/API, just not part of the branch's permanent history. Caught live (chunk 4.4b's own follow-up fixes, 2026-07-23): a docs-only completeness fix and an unrelated `EnvParseResult` type fix were first split into two properly-typed commits on one branch — that alone doesn't fix a "bundled unrelated changes" finding, since the PR is what actually determines the change's own title/type. Opened as two genuinely separate PRs instead ([PR #61](https://github.com/Pushedskydiver/moe/pull/61), [PR #62](https://github.com/Pushedskydiver/moe/pull/62)), each based independently off `main` (not one depending on the other's merge first, since they touched unrelated files).

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
- `docs/DA-REVIEW.md`, `docs/SELF-REVIEW.md`
- `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/RATIONALIZATIONS.md`, `docs/REVIEW-PATTERNS.md`
- `packages/agents/src/personas/*/prompt.md` — the do-not-touch list from `CLAUDE.md`
- `/.github/workflows/**`, `/.github/CODEOWNERS`
- Repo-root config: `/package.json`, `/pnpm-workspace.yaml`, `/pnpm-lock.yaml`, `/tsconfig.base.json`, `/tsconfig.json`, `/eslint.config.ts`, `/knip.json`

This list is the source of truth — re-check it rather than recite from memory, same discipline chief-clancy applies to its own list.
