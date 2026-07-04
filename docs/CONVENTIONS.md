# Code Conventions

Standards enforced across the `@moe` monorepo. All rules are configured in the root ESLint and Prettier configs. Adapted near-wholesale from chief-clancy's own `docs/CONVENTIONS.md` per `docs/VISION.md` §12 — this is the direct fix for the previous attempt's "AI-code smells, inconsistent, hard to navigate" failure mode. Deltas from the source are called out explicitly; everything else is adopted because it's genuinely good discipline, not because it happens to be chief-clancy's.

**Status:** target discipline, config not yet scaffolded — `BUILD_PLAN.md` chunk 0 wires the actual ESLint/Prettier config to match this document.

---

## Authoring these rules

Two shapes live here:

- **Mechanical rules** — taste-invariant, checkbox-suitable ("No `any`", "No `reduce()`", "Explicit return types on exports"). A reviewer applies the rule without interpreting intent.
- **Taste-shaped rules** — reader-experience judgments a checkbox cannot capture (beat spacing, extraction depth, variable-name earning). Prose that makes the intent legible; not a weaker rule, a different enforcement surface. The bar is "does the intent survive a hostile re-read?", not "can a mechanical reviewer tick a box?"

Many rules blend both shapes. Classify by which enforcement surface carries the load. Strong rules prevent drift; fuzz invites rationalization. When a rule is taste-shaped, write the strongest clearest prose you can, not a weaker bullet.

---

## Complexity Limits (ESLint)

| Rule                           | Limit                      | Rationale                                                                        |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------------------- |
| `complexity` (cyclomatic)      | 10                         | NIST standard. Forces extraction of complex logic.                               |
| `sonarjs/cognitive-complexity` | 15                         | Penalises nesting over flat branching. More forgiving for early-return patterns. |
| `max-lines-per-function`       | 50 (skip blanks/comments)  | Forces decomposition. If a function needs 51 lines, it's doing two things.       |
| `max-lines` (per file)         | 300 (skip blanks/comments) | Keeps modules focused.                                                           |
| `max-params`                   | 3                          | 3 is the limit. 4+ params must use an options object.                            |
| `max-depth`                    | 3                          | No deep nesting. Forces early returns and extraction.                            |

These are exactly chief-clancy's numbers — this is the specific discipline named in `docs/VISION.md` §12 as the fix for "an LLM writes one 400-line function."

---

## Functional Rules (eslint-plugin-functional)

| Rule                   | Setting                                        | Notes                                                                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `no-let`               | error                                          | `const` everywhere. Disable per-line where genuinely needed.                  |
| `immutable-data`       | error (ignoreImmediateMutation, ignoreClasses) | No `obj.foo = bar`, no `arr.push()`. Spread/concat. Test files exempt.        |
| `prefer-readonly-type` | warn (allowLocalMutation)                      | Function params marked readonly. Gradual adoption.                            |
| `no-loop-statements`   | warn                                           | Prefer `.map()/.filter()`. Disable for orchestration where loops are clearer. |

---

## Architecture Enforcement (eslint-plugin-boundaries)

**Settled at `BUILD_PLAN.md` chunk 0.3** — confirmed unchanged from the first-cut table, matching `CLAUDE.md`'s Architecture section. Enforced via `eslint-plugin-boundaries` in `eslint.config.ts`, verified against both a legal and an illegal cross-package import before landing. Delta from chief-clancy: this is moe's own package graph, not a port of theirs.

| From (type)              | May import from                                         |
| ------------------------ | ------------------------------------------------------- |
| `core`                   | `core`                                                  |
| `memory`                 | `memory`, `core`                                        |
| `agents`                 | `agents`, `memory`, `core`                              |
| `slack`                  | `slack`, `core`                                         |
| `github`                 | `github`, `core`                                        |
| `server` (`apps/server`) | `server`, `agents`, `memory`, `slack`, `github`, `core` |

`core` holds shared types/schemas and the ticket orchestrator. Every persona process (`apps/server`, parameterized by persona ID) sits at the top of the graph — it's the only thing allowed to import everything else.

---

## Import Ordering (@ianvs/prettier-plugin-sort-imports)

Imports are sorted into 5 groups, separated by blank lines:

| Group                 | Pattern                             | Example                                          |
| --------------------- | ----------------------------------- | ------------------------------------------------ |
| 1. Type imports       | `import type { ... }` from anywhere | `import type { Ticket } from '@moe/core'`        |
| 2. Node built-ins     | `node:*`                            | `import { resolve } from 'node:path'`            |
| 3. Third-party        | npm packages                        | `import { z } from 'zod'`                        |
| 4. Workspace packages | `@moe/*`                            | `import { createTicket } from '@moe/core'`       |
| 5. Local              | `./`, `../`                         | `import { parseClaim } from './claim-schema.js'` |

**Delta from chief-clancy: no path aliases.** Chief-clancy's group 5 includes `~/c/`-style deep-import aliases (needed because it ships esbuild bundles from a CLI). Moe is a long-running ESM service with no bundling step — group 5 is plain relative imports only. Deep imports across a package's own internal folders use ordinary relative paths; imports across package boundaries always go through the package's `@moe/*` entry (group 4), never a relative path that reaches outside `src/`.

Enforced on save and pre-commit via Prettier. Zero manual effort after setup.

---

## Code Style

- **No `reduce()`.** Use `.map()/.filter()` chains or explicit simple functions. Readability over cleverness.
- **Max 3 chained method calls.** Beyond 3, assign intermediate results to named variables. Inline callbacks in chains must be short (1–2 lines) — extract longer logic into a named function, then call it from a short wrapper arrow.
- **No bare function references in array callbacks.** Always wrap: `.map((x) => fn(x))`, not `.map(fn)`. Array iteration methods pass `(value, index, array)` — extra arguments cause silent bugs when the function accepts optional parameters, has overloads, or depends on generic inference. Bare references also lose `this` binding. Enforced by `unicorn/no-array-callback-reference`. Type-guard predicates (`.filter(isDefined)`) and built-in constructors (`.filter(Boolean)`, `.map(Number)`) are exempt.
- **No long ternaries.** If it doesn't fit on one line, early-return when one branch is empty or extract a function. When both branches are plain values (no call, no `await`), a multi-line ternary assigned to a named `const` is acceptable.
- **Don't hoist a call out of its guard.** A call gated behind a ternary branch runs only on that branch. Hoisting it to a `const` above the ternary evaluates it unconditionally — changing semantics when the call has side effects or can throw, and paying the cost either way.
- **No nested ternaries.** Ever.
- **Empty fallback goes on the else branch.** When one branch is an empty value (`undefined`, `null`, `''`, `[]`), put it second: `!isValid ? 'error' : undefined`, not `isValid ? undefined : 'error'`. If the result is still multi-line, apply the early-return from "No long ternaries" instead.
- **TSDoc on package public API only.** Public API = symbols exported from a path declared in `package.json` `exports`. Internal-only packages (if any) don't get a TSDoc rule. TSDoc must add semantics beyond the signature: units, invariants, error conditions, edge-case behaviour, cross-function contracts, or _why_ the symbol exists.
  - **Declaration site, not re-export site.** When a symbol is declared internally and re-exported, TSDoc lives on the source declaration. Trace through re-exports to the original declaration file. Intermediate barrels carry no TSDoc.
  - **Exported symbols only.** Private helpers in the same file don't inherit the requirement.
  - **Internal functions:** no TSDoc unless the WHY is non-obvious.
  - **Delete TSDoc that restates the signature** (`@param name - The name`).
  - **Immediately above the export.** No blank line between TSDoc and the `export` keyword it documents.
- **Explicit return types on exported functions.** TypeScript inference is for internal code, not public API.
- **No `any`.** Use `unknown` + type narrowing.
- **Prefer annotations and `satisfies` over `as`.** `const x: T = ...` beats `const x = ... as T`; `satisfies` validates the shape while preserving the inferred type. `as const` is fine. When `as` is necessary (post-`JSON.parse`, deliberate widening, wrong library types), keep the unsafe region small and comment why. `as unknown as X` is almost always wrong in production — redesign the types. In tests, prefer `makeX()` builders over partial `as unknown as`.
- **`!` non-null sparingly.** Only when locally provable. Prefer early return or explicit null check.
- **Pure functions by default.** Side effects (Slack API calls, GitHub API calls, filesystem, the database) isolated to boundary functions. Pure logic extracted into separate functions that take data in and return data out.
- **Dependency injection via function parameters** for I/O. Pass the Slack client, pass the DB handle — don't import live implementations in pure logic modules.
- **Options objects for 4+ parameters.** 3 is the ESLint limit. 4+ must use an options object with named properties.
- **Unused parameters:** prefix with `_` if keeping for API stability. Otherwise remove.
- **Max one level of function nesting.** No functions defined inside functions defined inside functions.
- **Beat spacing.** Separate distinct concerns within a function body with one blank line — never more than one. A guard clause and its early return are one concern. A single-purpose function needs no internal blank lines regardless of length.
- **`type` over `interface`.** Use `type` by default. Only use `interface` for declaration merging or `extends` on object hierarchies.
- **Co-locate types with their module.** Types used by a single module live in that module's file. Types used across multiple modules go in `types/`.
- **Name compound boolean conditions.** Extract multi-part conditions into named `const` variables. The `if` statement should read like prose.
- **Extract a variable only when the name teaches the reader something.** Before hoisting to a named `const`, ask: "what does this name teach that the expression doesn't?" If the answer is `result`, `data`, `foo`, inline it.
- **Inline trivial types; name complex or reused shapes.** Single-property types always inline. Two-property types inline when they fit one line; otherwise name them. Three or more properties, nested shapes, or reused types earn a named `type` above the function.
- **Co-locate helpers with their module.** Extract to `shared/` only when used by 2+ modules. No premature `utils/` junk drawers.
- **Match extraction depth to reading mode.** Composition code (factories, DI wiring, module assembly) extracts aggressively. Logic code (algorithms, data transforms, business rules) keeps logic inline. If a file does substantial amounts of both, split it.
- **Function verb vocabulary.** `make*` (factory returning a closure/adapter), `create*` (single-call factory returning a fully-initialised object), `build*` (multi-step structured-value construction), `resolve*` (derivation with a fallback/lookup chain), `parse*` (unstructured → typed), `detect*` (environment/runtime probe), `ensure*` (idempotent side-effect), `fetch*` (external I/O), `find*` (search a pre-loaded collection), `is*/has*/can*/should*` (boolean predicate), `wire*` (DI composition). Dropped: `compute*/calculate*` (leaks mechanism — use noun-phrase form), `attempt*/try*` (redundant when the return type already encodes failure), generic `get*/set*`.
- **Boolean naming: `is*/has*/can*/should*` prefix.**
- **Type suffix conventions.** `*Opts` for options bags, `*Result` for discriminated-union returns, `*Ctx`/`*Context` for runtime context, `*Deps` for dependency-injection shapes, `*Fn` for function type aliases. Category markers on a meaningful name, not a license for mechanical `FooOpts` naming.
- **Abbreviation allowlist.** `ctx`, `opts`, `fs`, `fn`, `env`, `id`, `url`, `args`, `argv`, `i` (loop index). Project-local abbreviations fine when unambiguous (`pr` for pull request OK).

---

## Zod

**Delta from chief-clancy: full Zod v4, not `zod/mini`.** Deliberate reversal, per `docs/VISION.md` §12 — this is a load-bearing rule, not a style preference. Every Slack event, GitHub webhook payload, and status-claim object (`docs/VISION.md` §7.6) is validated against a real Zod schema, no exceptions. `.safeParse()` on anything crossing a process boundary (Slack API, GitHub API, the shared ticket database).

---

## Portability

- **Use `node:path`, never string concatenation with `/`.** Filesystem paths go through `join()`, `resolve()`, or `relative()` from `node:path`. URLs and repo-slug labels are not filesystem paths — template-literal joining is fine for those.
- **Lint floor:** `n/no-path-concat` enabled on `packages/*/src/**/*.ts` and `apps/*/src/**/*.ts`.

---

## Export Hygiene

- **Types start internal.** Only add `export` to a type when it's consumed outside the file.
- **Aliasing colliding cross-persona names.** When multiple personas export a same-named helper, alias at the import site or rename the source export.
- **Export for testability is allowed.** When a pure function needs direct unit testing, export it from the source file — don't add a barrel just for tests. Package-entry `src/index.ts` remains the package-boundary surface.

---

## Folder Structure

A **concept folder** exists for one of two reasons:

- **Wrapper folder** — a single concept has ≥2 source files (tests don't count).
- **Grouping folder** — multiple related concepts clustered by a name the team actually uses (Evans, _Domain-Driven Design_, ubiquitous language). Example: `agents/personas/` (per-persona subfolders), `core/ticket-lifecycle/`.

Single-file concepts stay flat. No `feature-name/feature-name.ts` wrappers.

### Barrels (`index.ts`)

| Category                           | Where it lives                             | Status                                                                               |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Package entry** (`src/index.ts`) | Every workspace package                    | Defines the package's public surface; cross-package consumers import from here only. |
| **Multi-content folder**           | A folder already holding multiple concepts | No barrel. Consumers import direct files.                                            |
| **Single-impl wrapper**            | Folder wrapping a single source file       | Flattened — folder removed, file lifted to parent.                                   |

Consumers within a package use relative paths. Cross-package consumers use the package entry (`@moe/core`) — never a relative path reaching outside `src/`.

### `shared/` discipline

`shared/` holds utilities imported by **2+ sibling folders** with no clearer home. If contents cluster into a concern, they earn their own folder. No `utils/` junk drawers.

---

## External API Integration Patterns

**Delta from chief-clancy: this replaces "Board Implementation Patterns."** Chief-clancy's board adapters (GitHub/Jira/Linear ticket systems) and moe's Slack/GitHub integrations solve the same structural problem — normalize a third-party API into moe's own internal shape, safely. The patterns transfer directly:

- **Reuse header/auth builders.** Every integration (`slack/`, `github/`) has a single function building auth headers or an authenticated client. Never manually construct auth in other functions.
- **Schema-validate all API responses.** Use a Zod schema and `.safeParse()` on every Slack/GitHub API response. Never use `as` on external API data without a comment justifying why a schema can't be used.
- **Cache via a `Cached<T>` class.** No module-level `let` for caches. Invalidate by passing a `refresh` flag to the fetch function, not by storing sentinel values.
- **Normalize at the boundary.** Map provider-specific shapes (a Slack message event, a GitHub issue payload) to moe's own internal types in one place per integration — not scattered across call sites.
- **Extract helpers to stay under 50 lines.** Integration modules extract their fetch/transform/handle steps as separate module-level functions.

---

## Testing Standards

- **Co-located tests** — `<name>.test.ts` next to source. **Delta from chief-clancy: flat, no wrapping folder** (chief-clancy nests as `<name>/<name>.test.ts`; moe's flatter single-file-concept folder rule — see Folder Structure — makes the wrapping folder redundant for single-file concepts).
- **Unit tests for every exported function** — no exceptions.
- **Property-based tests** (fast-check) for parsers, serialisers, and the risk-tier classifier (`docs/VISION.md` §8.1) — anything whose correctness matters across a wide input space. §8.1 has an open definitional question (multi-directory diffs, directory renames, the track-record threshold N) — don't write the classifier's property tests until that resolves, or they'll need rewriting the moment it does.
- **Integration tests** for cross-module workflows (a persona process against a real test database, a Slack event through the classification cascade).
- **Coverage threshold: 80%** per package (statements, branches, functions, lines).
- **Tracer bullet TDD for new logic.** Vertical slices, not horizontal. One test → implement to pass → next test → repeat → refactor. Never write all tests first then all implementation.
- **Tests exempt from functional rules** — `immutable-data` off, `max-lines-per-function` off in test files.
- **Persona-replay tests are load-bearing, not optional.** A persona's synthetic unit tests shaped to a schema can't catch a prompt↔schema mismatch — only recorded replays of the real prompt can (a hard-won lesson from the previous attempt). Any persona prompt change needs a replay pass, not just green synthetic tests.

---

## Error Handling

**Return a `Result`-shaped discriminated union for expected failures; `throw` for broken invariants.** TypeScript has no checked exceptions — a signature that can throw gives no type-level signal. Return-typed failures make failure visible at call sites.

**The risk-tier classifier specifically (`docs/VISION.md` §8.1) isn't implementable yet, not just untestable.** §8.1 has an open definitional question — what "track record" means for multi-directory diffs, directory renames/moves, and brand-new directories — that blocks the tier model for the common case. This applies to writing `classifyRiskTier` (or any Result-shaped function implementing the gate) itself, not only its property tests (see Testing Standards above). Don't write the real implementation until §8.1 resolves.

- **Return a `Result`-shaped discriminated union** for expected domain failures — Slack API failure, GitHub API failure, validation fail, ticket-claim conflict; anything the caller should meaningfully handle.
- **`throw` only for:** programmer bugs / invariant violations (impossible states, exhaustiveness failures), or unrecoverable conditions.
- **Pick ONE Result shape and enforce it.** House shape: `{ ok: true, ...data } | { ok: false, error: { kind: '<tag>', ...context } }`. The `error` channel is a tagged discriminated union, not a bare string.
- **Default to an opaque-unknown kind for uncategorised failures**: `{ kind: 'unknown'; message: string; cause?: unknown }`. Promote to a named variant the first time a caller wants to branch on category — not before.
- **Don't wrap `throw` in a `Result` shape defensively.** A function that genuinely cannot fail in its domain should return `T`, not an `{ ok: true }` union with no reachable failure.

---

## Naming Conventions

- **Files:** kebab-case (`fetch-ticket.ts`, `claim-schema.ts`)
- **Directories:** kebab-case (`ticket-lifecycle/`, `slack-identity/`)
- **Types/Interfaces:** PascalCase (`Ticket`, `StatusClaim`, `PersonaConfig`)
- **Functions:** camelCase (`createTicket`, `claimAndFetch`)
- **Constants:** UPPER_SNAKE_CASE for env vars and status values (`MOE_COST_CAP_MONTHLY`, `TICKET_CLAIMED`)

---

## When to adjust rules

If a lint rule creates unreadable workarounds in practice, flag it. Rules can be tuned based on real experience. Don't suppress warnings silently — discuss and adjust the config.

**`eslint-disable` is a last resort.** Before suppressing a rule, look for a simpler alternative. Only disable when no simple alternative exists and the workaround would be worse than the suppression.

---

## Output style

Selective brevity for chat output, commit messages, and PR comments. Reasoning accuracy degrades as input length grows and recall is U-shaped over long context — real evidence for conciseness in conversational output, applied selectively (elaboration-heavy tasks get _worse_ under blanket compression, so this is not a universal rule).

### Where to be terse

- Chat status updates and progress reports
- Commit messages (already enforced by `docs/GIT.md` gitmoji conventions)
- PR comment replies and review feedback summaries

### Where to elaborate (do NOT compress)

- Persona prompt files (`packages/agents/src/personas/*/prompt.md`) — reasoning artifacts the persona follows step-by-step
- `docs/VISION.md`, `docs/CEREMONIES.md`, `docs/PERSONAS.md` — this rebuild's own diagnosis was partly that load-bearing prose got compressed past the point of being useful
- Error messages, security warnings, irreversible-action confirmations
- Anything inside fenced code blocks

### Rules for terse output

- Drop filler, hedging, pleasantries (`just`, `really`, `basically`, `I'd be happy to`)
- Prefer short synonyms (`big` not `extensive`, `fix` not `implement a solution for`)
- Keep code blocks, file paths, version numbers, identifiers EXACT — never paraphrase
- Never use `I/we/now/currently` filler in commit messages
- Never include AI attribution noise in commit messages or PR bodies (`Generated with Claude Code` footers, emoji tags) — but `Co-Authored-By:` trailers are the canonical way to credit AI assistance and should remain
