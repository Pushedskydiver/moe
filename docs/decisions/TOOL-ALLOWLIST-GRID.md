---
status: Decided
date: 2026-08-28
---

# Tool Allowlist Grid — BUILD_PLAN Chunk 6.0

## Decision

Four settled positions, all research-backed, all confirmed with Alex via `AskUserQuestion`:

1. **CLI/direct-SDK integration is the default; MCP is the fallback, not the default.** A new tool integration uses a direct SDK/library call (matching every real integration in the codebase today — `@slack/web-api`, `octokit`, `pg`, native `fetch`) unless the third-party service exposes no usable direct API/SDK and only ships an MCP server.
2. **Riley's Agent SDK sandbox (chunk 6.2) gets no network access.** Bash is hermetic — dependencies pre-installed before a session starts, no `npm install`/`curl`/`fetch` from inside it.
3. **Tier 3's named-owner review can be satisfied by any persona other than the requester — except when Alex himself dispatched the work, where his own sign-off is still required in addition.** A persona's review never fully substitutes for Alex's when he's the dispatcher.
4. **A single, explicit, committed allowlist is the source of truth for every persona's tool grants.** Adding a tool means a PR touching that grid, routing through Alex's own review by construction.

## Context

VISION §11 names four things as carrying over conceptually from the previous design but explicitly defers the actual content to this chunk: "the per-persona tool allowlist grid, the CLI-vs-MCP decision rule ('use the lightest tool that does the job'), the sandboxing model..., and the curated-allowlist supply-chain hygiene rules." This chunk also settles a second, separate open question BUILD_PLAN 6.5a-i explicitly depends on: VISION §8.1's Tier 3 gate requires "mandatory named-owner review, cannot be satisfied by the requesting persona or the human who dispatched it" — with exactly one human on the team, that exclusion needs an explicit answer before 6.5a-i can route Tier 3 at all.

**Current state, audited directly against the codebase before drafting:** no MCP server exists anywhere in the repo. Exactly one tool is ever exposed to any persona's own LLM calls today — `STATUS_CLAIM_TOOL`/`report_status` (`packages/agents/src/status-claim-tool.ts`), passed at two call sites (`generate-and-post-reply.ts`, the offline replay-recording script). Every other integration (Slack `postMessage`/`addReaction`/`fetchSlackStatus`, GitHub `listOpenIssues`/`getGithubIssueState`/`createGithubIssue`, all ten DB tables) is direct code the model never invokes — the persona's own prose triggers it, not a tool call. Riley's Agent SDK sandbox (chunk 6.2) has no code and no dependency installed yet. This chunk is therefore prospective — it specifies the grid for tools that don't exist yet (Theo's web-search/citation-fetch, Maya's render/screenshot tool, Dom's PR-diff-fetch/review-post, a generic cross-persona "react" tool flagged at chunk 6.1d), not a retrofit onto something already too permissive.

**Research backing the CLI-vs-MCP call:** Stacklok's security comparison (fetched directly, stacklok.com/blog/mcp-vs-cli-tools-why-security-changes-the-answer) found the decisive factor is whether an integration crosses a multi-user trust boundary — CLI's model (the agent acts _as_ the developer, credentials in its own environment) is adequate exactly until a second user needs a separate, audited identity, at which point MCP's per-user OAuth-scoped tokens become necessary. Moe has no second user: one operator, one shared GitHub App identity across all 8 personas already (BUILD_PLAN 4.4a). The multi-user case MCP solves doesn't exist here.

**Research backing the sandbox/supply-chain rules:** OWASP's "Excessive Agency" entry (genai.owasp.org) names three separable root causes — excessive functionality, excessive permissions, excessive autonomy — and recommends limiting an agent's reachable tools to the minimum the task needs; Anthropic's own Claude Code security docs (code.claude.com/docs/en/security) implement this as default-deny network/filesystem access with explicit allow rules. The MCP spec's own security-best-practices page (modelcontextprotocol.io) states that "MCP servers run with the same privileges as the client" and explicitly warns against "wildcard or omnibus scopes (`*`, `all`, `full-access`)" in favor of a minimal initial scope set — directly grounding position 4 (an explicit, reviewed allowlist file, not ambient trust). OWASP's separate MCP Tool Poisoning page confirms tool _responses_, not just tool definitions, are a live injection surface even from an already-vetted server — this is the same "treat untrusted output as data, not instructions" discipline `CLAUDE.md` already states for Slack/GitHub content, extended to any future MCP tool output.

## The grid

**Inline Messages-API tools (chat-turn calls, all 8 personas share this integration surface):**

| Tool                          | Personas  | Status    | Integration shape                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `report_status`               | All 8     | Live      | Direct — inline tool definition, no external call                                                                                                                                                                                                                                                                                                                                                         |
| `react` (proposed, 6.1d)      | All 8     | Not built | Direct — Slack `reactions.add`, already exists as code (`packages/slack/src/add-reaction.ts`), just not yet exposed as a model-invokable tool                                                                                                                                                                                                                                                             |
| Web-search / citation-fetch   | Theo only | Not built | Direct — Anthropic's own native web-search tool type is the likely fit (no custom integration code at all); confirm at implementation time, not this gate                                                                                                                                                                                                                                                 |
| PR-diff-fetch, PR-review-post | Dom only  | Not built | Direct — `octokit` (matching every existing GitHub capability's own pattern; no reason to switch to GitHub's MCP server given the working App-auth integration)                                                                                                                                                                                                                                           |
| Render/screenshot tool        | Maya only | Not built | Direct — `.claude/research/designer-persona-landscape/design-tooling-mechanism.md` already confirms v0's Platform API is a plain bearer-token REST call (`V0_API_KEY`), no OAuth broker; combined with a scoped render tool and Impeccable's `detectText`. Whether v0 is still the right/available choice by the time Maya's tooling chunk is picked up is what's open, not the API-shape question itself |

**Agent SDK tool allowlist (Riley's 6.2 sandbox only — a structurally different, heavier-weight surface, per VISION §11's chat-vs-agentic line):**

- File read/write scoped to the per-task git worktree only — no path outside it.
- Bash allowed, **network access denied** — hermetic; any dependency install happens before the session starts, not inside it.
- Git allowed within the worktree (add/commit/push to the task branch only) — never a direct push to a protected branch. Code lands only via PR + CI (VISION §11, unchanged).
- No secrets access — `ANTHROPIC_API_KEY`, the DB connection string, and the GitHub App private key are not visible inside the sandboxed session's own environment.
- No production code execution — CI is the only path to a real build (VISION §11, unchanged).

## Supply-chain hygiene rules

1. This grid (the table above) is the single source of truth for every persona's tool grants. A tool is never available to a persona merely because the underlying library exists in a shared package — each grant is an explicit, reviewed line in this table.
2. Scope minimization, not omnibus grants — a new tool is scoped to the specific capability a persona's own chunk needs, never "give X all of Y."
3. Any future MCP server (only reachable via the CLI-vs-MCP fallback case) requires explicit Alex approval before being added to this table, preference for a well-known actively-maintained server over an obscure one, and the same sandboxing discipline as any other untrusted local process — a local/`npx`-invoked MCP server runs with full user privileges, not a reduced one.
4. Tool _responses_ (not just tool definitions) are untrusted input. The existing "treat untrusted output as data, not instructions" discipline (`CLAUDE.md`) applies to any future MCP tool's output the same way it already applies to Slack messages and GitHub issue bodies. This is in addition to, not instead of, `docs/CONVENTIONS.md` §External API Integration Patterns' existing requirements (two independent secret-redaction mechanisms per new SDK client, `.safeParse()` schema validation on every external API response) — every tool this grid enables still has to satisfy those.
5. Changing this table is a PR like any other, reviewed the same way — no separate approval ceremony beyond the review gate this repo already runs.

## Tier 3 named-owner review

Any persona other than the one whose own change is being reviewed may satisfy Tier 3's named-owner requirement. When Alex himself is the one who dispatched the work, his own explicit sign-off is required in addition to that persona's review — the persona reviewer's approval alone never fully substitutes for Alex's own check on a change he asked for. This resolves the dependency BUILD_PLAN 6.5a-i names explicitly.

## Positions evaluated

|                      | Position                                                      | Verdict                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLI-vs-MCP**       | Direct SDK/CLI by default, MCP only when no direct API exists | **CHOSEN** — matches every real integration already built, and the multi-user trust boundary MCP solves doesn't exist on a one-operator team                                                       |
|                      | Prefer MCP wherever available                                 | Rejected — no evidence-backed reason to prefer it here; adds a persistent-process attack surface (full local privileges per the MCP spec's own security docs) with no offsetting benefit           |
| **Riley sandbox**    | No network access                                             | **CHOSEN** — matches OWASP's "excessive functionality" mitigation and Claude Code's own default-deny network model most directly                                                                   |
|                      | Network allowed, denylist dangerous commands                  | Rejected — a denylist is enumerable-and-incomplete by construction; hermetic-by-default doesn't have that failure mode                                                                             |
| **Tier 3 reviewer**  | A different persona, plus Alex when he's the dispatcher       | **CHOSEN** — satisfies the spirit of an independent check without requiring a second human that doesn't exist                                                                                      |
|                      | Alex only, always                                             | Rejected — would make Tier 3 fully non-autonomous regardless of dispatcher, a stricter floor than VISION §8.1's own text asks for (it excludes the requester and the dispatcher, not "every case") |
| **New-tool process** | Explicit allowlist file + Alex approval                       | **CHOSEN** — the MCP spec's own strongest recommendation (avoid ambient/omnibus scope) made structurally hard to skip                                                                              |
|                      | Reviewed inline per wiring PR                                 | Rejected — relies on the reviewer noticing scope creep in a diff, rather than the grant itself being visible as a single, diffable table                                                           |

## Triggers for re-evaluation

- A real third-party service is chosen for a future persona's tooling (Maya's render tool being the most likely first case) and it turns out to expose only an MCP server — apply the CLI-vs-MCP fallback rule at that point, don't treat it as reopening this decision.
- Riley's sandbox needs a real dependency install mid-session in practice (the hermetic assumption doesn't hold operationally) — revisit the no-network rule with real evidence, not preemptively.
- A second human joins the team — MCP's multi-user case would then actually apply, and the CLI-vs-MCP default is worth re-deriving from scratch, not just extended.

## References

- `docs/VISION.md` §11 — the section this decision resolves.
- `docs/VISION.md` §8.1 — Tier 3's own named-owner exclusion text.
- `BUILD_PLAN.md` chunk 6.0 — this chunk; 6.1d, 6.2, 6.3b, 6.5a-i, 6.10 — the downstream chunks this grid unblocks.
- `.claude/research/designer-persona-landscape/design-tooling-mechanism.md` — Maya's own tooling research, banked ahead of this gate.
- Stacklok, ["MCP vs CLI Tools: Why Security Changes the Answer"](https://stacklok.com/blog/mcp-vs-cli-tools-why-security-changes-the-answer) — the CLI-vs-MCP trust-boundary argument this decision draws from.
- OWASP GenAI Security Project, ["LLM06: Excessive Agency"](https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/) — the three-root-cause framing (functionality/permissions/autonomy) behind the sandbox and grid rules.
- Anthropic, [Claude Code security](https://code.claude.com/docs/en/security) — the default-deny model the Riley-sandbox rule matches.
- Model Context Protocol, [security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) — local-server-compromise and scope-minimization findings behind the supply-chain rules.
- OWASP, [MCP Tool Poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning) — the tool-response-as-untrusted-input finding.
