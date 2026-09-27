---
status: Decided
date: 2026-09-27
---

# Single Rulebook

## Decision

`AGENTS.md` is the single rulebook every agent reads. `CLAUDE.md` becomes a stub — a heading, one sentence, and an `@AGENTS.md` import — never a place to add a rule. Path-scoped rules (persona prompts, Slack/GitHub integrations) live in `.claude/rules/`, each with a `paths:` glob. The `AGENTS.md`-from-`CLAUDE.md` generator, its `literal`/`source-only` markers, and its CI freshness job are retired.

## Context

Alex adopted PCR Formulation's rulebook shape (Session 47, `AskUserQuestion`), in preference to the generated-sync approach chunk 0.7 built. Session 48 verified Claude Code's own docs directly: Claude Code reads `AGENTS.md` natively (v2.1.277+), but only when no `CLAUDE.md` exists in the directory tree — a `CLAUDE.md` that merely mentions `AGENTS.md` hides it from that native read, so the stub carries a heading and one sentence besides the import (matching PCR's shape) rather than being reduced to a single line, and the redirect itself has to be the literal `@AGENTS.md` import line, not prose about it. The stub is kept rather than `CLAUDE.md` deleted outright, because some sessions (the first after an upgrade, or with the `agents-md` plugin disabled) can't read `AGENTS.md` directly and still need something to find. The required-check swap (below) is Session 50.

## Consequences

- The generator (`scripts/generate-agents-md.ts`), its two markers, and CI's "AGENTS.md freshness" job are deleted. `scripts/check-rulebook.ts` is a separate script (one script per file family, not an extension of `scripts/check-agent-frontmatter.ts`) — it reuses that file's `extractFrontmatter` rather than duplicating it, and its checks run in CI's "Agent frontmatter" job, whose name Alex keeps unchanged so he can swap the two required checks ("AGENTS.md freshness" out, "Agent frontmatter" in) at merge without a branch-protection rename.
- The do-not-touch list stays in `AGENTS.md` §Non-obvious constraints in full — `.claude/rules/` is a Claude Code mechanism only (Codex never loads it), so a `.claude/rules/` file is a reminder at the point of edit, not the rule's only statement.
- `integrations.md`'s scope (Slack + GitHub only) deliberately mirrors `AGENTS.md`'s own "touching a Slack/GitHub integration" trigger. `docs/CONVENTIONS.md` §External API Integration Patterns also covers the Anthropic client and the GOV.UK bank-holidays client — the rule file doesn't reach those; `docs/CONVENTIONS.md` remains the one place that does.
- `generate:fly-configs`'s template (`packages/core/src/deploy/fly-app-config.ts`) still says `CLAUDE.md` in its generated comment, which resolves through the stub — left alone deliberately so the eight generated `fly.*.toml` files don't churn over a wording-only change.
