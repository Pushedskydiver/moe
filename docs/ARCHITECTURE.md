# Architecture

System architecture and package map — the "what's built and how it fits together" reference. Written fresh for moe rather than templated off chief-clancy's own `ARCHITECTURE.md`: chief-clancy's version documents a mature, multi-month installer/pipeline/board system moe doesn't have yet. This doc grows alongside moe's own build; it doesn't front-run it.

**Naming discipline, same as `CLAUDE.md`'s own status paragraph:** this doc names what's built by file/package, not by BUILD_PLAN chunk number, so it stays accurate as chunks land — check `BUILD_PLAN.md`'s checkboxes for exactly which stage the codebase is at.

## Overview

Moe is a monorepo of `@moe/*` packages plus one deployable app (`apps/server`). It's a long-running Slack-native service — not a CLI, not something that bundles or publishes to npm. `docs/VISION.md` is the product-level architecture (what the team does, the cast, ceremonies); this doc is the code-level architecture (how the packages fit together).

## Package map

| Package           | Purpose                                                        | Status                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Shared types/schemas, the ticket orchestrator                  | `Ticket`/board-status/severity/`projectKey` schemas (chunk 1.1); `conversation_turns` table + repository (chunk 2.4b); `persona_cost_daily` table + repository, atomic per-day accumulation (chunk 2.6a); orchestrator logic not yet built                                                                                                    |
| `packages/memory` | Cross-session/cross-persona memory substrate                   | Scaffolded (one fn, one test)                                                                                                                                                                                                                                                                                                                 |
| `packages/agents` | Persona definitions (prompts, per-persona config)              | `PersonaConfig` schema + parser (chunk 2.2, extended with `slackAppToken` at 2.3); the `report_status` claim-gate tool and its composer, its first `@moe/core` dependency (chunk 2.5); `generateReply` surfaces per-turn token usage, priced against dated Sonnet-5 rates (chunk 2.6a); persona prompts not yet built (Stage 5, do-not-touch) |
| `packages/slack`  | Slack integration (Socket Mode, per-persona Bot Apps)          | Inbound message normalization, Socket Mode listener, SDK-logger redaction adapter, unrecoverable-start-error classifier, `chat.postMessage` wrapper (chunk 2.3)                                                                                                                                                                               |
| `packages/github` | GitHub integration (board, PRs, tickets)                       | Scaffolded (one fn, one test)                                                                                                                                                                                                                                                                                                                 |
| `apps/server`     | The deployable long-running process — one instance per persona | Boots, health-check endpoint, structured logging, Slack Socket Mode wiring (chunks 2.2/2.3); thread-scoped conversation history via its first `@moe/core`/DB dependency (chunk 2.4b); wires the `report_status` claim gate into the reply path (chunk 2.5); accounts each turn's LLM cost against the persona/day bucket (chunk 2.6a)         |

"Scaffolded" means: package exists, builds, has one passing test proving the toolchain — no real domain logic yet. Stage 1 (per `BUILD_PLAN.md`) is where `core` gets its actual ticket/claim domain model — chunk 1.1 (ticket types) is the first slice; the atomic-claim primitive lands at 1.3.

## Dependency direction

Settled at `BUILD_PLAN.md` chunk 0.3, enforced via `eslint-plugin-boundaries` in `eslint.config.ts` (verified against both a legal and an illegal cross-package import before landing — see `docs/CONVENTIONS.md` §Architecture Enforcement for the enforcement table, and `docs/DA-REVIEW.md` §Claim-extraction pass for the resolver gotcha that bit that chunk: the rule was silently inert until a resolver was added, and the only thing that caught it was writing a fixture and watching it fail to fail).

```
core                                  (shared types/schemas, ticket orchestrator — zero deps on siblings)

memory     ← core
agents     ← memory, core
slack      ← core
github     ← core

server     ← agents, memory, slack, github, core     (apps/server — the only package allowed to import everything)
```

`core` sits at the bottom by design — every other package depends on it, it depends on nothing else in the graph. `apps/server` sits at the top — it's parameterized by persona ID and is the only thing allowed to import every package, matching the "one process per persona" topology below.

## Process topology

**Every persona is its own long-running process with its own Slack Bot App** (`docs/VISION.md` §4.5, §6.6) — not subordinate agents under one orchestrator process. This is settled (decided on evidence in VISION §4.5), unlike the package graph above, which is confirmed-but-revisitable. `apps/server` is the same codebase deployed N times (one per persona), not N different apps.

Ticket claims are atomic via database-level optimistic locking, not in-process coordination — there's no shared-memory orchestrator process arbitrating between personas. Each persona runs on its own machine, sharing one Neon Postgres instance for this claim mechanism (`docs/decisions/TOPOLOGY-AND-DATABASE.md`, BUILD_PLAN chunk 1.2a). What counts as a path's "track record" for the risk-tier gate that sits on top of this claim mechanism was an open definitional question (`docs/VISION.md` §8.1), resolved at BUILD_PLAN chunk 1.5 (`docs/decisions/TRACK-RECORD-DEFINITION.md`).

## Model client

Chat turns use the raw Anthropic Messages API; the Claude Agent SDK is reserved for Riley's heavyweight agentic coding sessions only (`docs/VISION.md` §11 — verified 2026-07-04, reversing an assumption inherited from the previous design). The SDK's per-`query()` subprocess spawn (~12s) and unbounded on-disk session-file accumulation are the wrong shape for a long-running service handling many short conversational turns.

## Directory structure

```
apps/
  server/          # the deployable process, one instance per persona
packages/
  core/            # shared types/schemas, ticket orchestrator
  memory/          # cross-session/cross-persona memory
  agents/          # persona definitions (do-not-touch: prompt.md files need Alex's approval)
  slack/           # Slack integration
  github/          # GitHub integration
docs/              # this doc set
.claude/
  agents/          # da-review, spec-grill, copilot-surrogate definitions
  research/        # gitignored — local research artefacts, never pushed
```

## Build system

pnpm workspaces (`pnpm-workspace.yaml`: `packages/*`, `apps/*`), Node 24 pinned via both `engines` and Volta (the two don't always agree in practice — see `docs/DEVELOPMENT.md` §Local dev environment), TypeScript (`tsc --noEmit` for typecheck, no separate build step beyond each package's own `build` script), Vitest per package. `pnpm knip` is a hard CI gate, not advisory, per `BUILD_PLAN.md`'s Stage-0 exit criterion.

No path aliases, no esbuild CLI bundling, no CommonJS interop — moe is a long-running ESM service, not a distributed CLI (`CLAUDE.md` §Non-obvious constraints). Full Zod v4 for runtime validation, a deliberate reversal of chief-clancy's `zod/mini` choice (`docs/CONVENTIONS.md`).

## Related docs

- [Glossary](GLOSSARY.md) — terminology
- [Decisions](decisions/) — the "why" behind non-obvious choices, including this doc's own dependency-direction and model-client calls
- [VISION](VISION.md) — product vision, ceremonies, the cast
- [CONVENTIONS](CONVENTIONS.md) — enforcement mechanics, code style
