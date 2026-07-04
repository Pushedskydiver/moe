# Self-Review Checklist

Line-level accuracy check performed after DA review but before opening a PR. Read every changed file (`git diff main...HEAD`) and check for detail-level issues that DA misses.

This checklist complements [DA-REVIEW.md](DA-REVIEW.md) with an explicit ownership split:

- **DA-REVIEW** owns the **architectural and comment/doc layer**: imports, guards, patterns, stale prose in TSDoc and comments.
- **SELF-REVIEW** owns the **code-level layer**: stale fixture values, mock URLs, wrong string literals, test isolation, copy-paste errors.

The Red Flags list lives in [DA-REVIEW.md](DA-REVIEW.md#red-flags--stop-and-reassess) — read it before walking this checklist. Don't duplicate Red Flags here; cross-reference instead.

This is a **living document** — when a bug or drift issue slips through DA + self-review + Alex's own PR review, add the specific check here immediately. The checklist grows from real mistakes, not hypotheticals.

**Adapted from chief-clancy's own `docs/SELF-REVIEW.md`.** That version cites specific chief-clancy PR numbers and package names as evidence for each rule. This version keeps the general disciplines and strips the borrowed evidence — moe starts this checklist evidence-free and grows its own citations from its own history.

See also: `docs/DEVELOPMENT.md` (full review gate flow) and `docs/TESTING.md` (test-specific disciplines).

---

## NOTICED BUT NOT TOUCHING

When you spot something worth improving outside your task scope, **list it — don't fix it**:

```
NOTICED BUT NOT TOUCHING:
- src/utils/format.ts has an unused import (unrelated to this task)
- The auth middleware could use better error messages (separate task)
→ Want me to create tasks for these?
```

Drive-by refactors mixed with feature work are harder to review, harder to revert, and hide bugs in noise. Stay in scope. The temptation to "quickly clean this up while I'm here" is exactly the kind of scope creep this codebase's own CLAUDE.md warns against — surface it as a NOTICED block and move on.

---

## Code accuracy

> Comment-level and TSDoc accuracy is owned by [DA-REVIEW.md §TSDoc & documentation](DA-REVIEW.md#tsdoc--documentation). Self-review focuses on accuracy in **actual code values**: fixture data, mock URLs, hardcoded literals, parameter usage. The §Consistency bullet on absolute phrases and supersession-footnote drift is owned by DA via the [Multi-section internal-consistency pass](DA-REVIEW.md#multi-section-internal-consistency-pass); every other §Consistency bullet and every other SELF-REVIEW section remains author-owned.

- Are all function parameters used? Remove unused params or use `_prefixed` naming if keeping for API stability
- Do mock/test URLs match the actual Slack/GitHub API endpoints they're standing in for? (read the production code to verify)
- Do fixture shapes match what the production code expects? (check Zod schemas and actual API calls)
- Do hardcoded string literals in test fixtures match the values the production code emits?
- Do hardcoded numeric expectations (`toHaveBeenCalledTimes(N)`, array length assertions) reflect the actual code path, not the OLD code path before your change?

## Type safety (line-level)

- Could an annotation (`const x: T = ...`) or `satisfies` replace this `as` cast? If `as` is necessary, is there a justification comment? Is `as unknown as X` avoided in production (tests: prefer `makeX()` builders)?
- Is `!` (non-null assertion) locally provable? Could an early return or explicit null check replace it?
- After a type guard (`typeof x === 'string'`), is the narrowed variable used correctly downstream?
- Are `??` (nullish coalescing) and `||` (falsy check) used correctly for the intended semantics?

## Test accuracy

- Are all mocks/spies/stubs reset in `afterEach`? Check for shared test state leaking between tests
- Are promises properly awaited in tests? Do async errors surface or get swallowed?
- Do test assertions use exact expected values, not ambiguous substrings? (`.toEqual({ id: '1' })` not `.toContain('1')`)
- Do any imported modules cache global state that could leak between tests? (reset caches in `afterEach`)
- Are `describe`/`it` blocks accidentally duplicated from copy-paste?
- Do test names accurately describe what is being tested?

## Test permissiveness audit

For every new regex assertion or slice-based string check, walk through the simplest wrong input the assertion would silently pass. The discipline is owned by [DA-REVIEW.md §Test permissiveness audit](DA-REVIEW.md#test-permissiveness-audit) — this is the self-review companion.

- For new regexes: write down a wrong-input example. Would the regex still match? If yes, tighten it.
- `\\?d` matches both `\d` and bare `d` (the literal escape is wrong — use `\\d`). Same trap for `\\?w`, `\\?s`, etc.
- `[^\n]*` middles in regex assertions silently allow swapped labels. Anchor the literal you actually care about.
- `content.indexOf(marker) + slice()` returns negative indexes when the marker is missing, and `slice` interprets negatives as end-relative — guard with `>= 0` and `end > start` before slicing. Extract a `sliceBetween()` helper to make the trap structurally impossible.
- Substring `toContain('foo')` when an exact match (`toBe('foo')`) is what you actually want
- `not.toContain` slices that don't bound the slice region — verify both slice markers exist before asserting absence

If the assertion would pass against the wrong input, tighten it before committing.

## Executable markdown accuracy

Persona prompt files and `.claude`/`.codex` slash-command/skill/workflow markdown are as load-bearing as TypeScript — apply the same rigour as code review. (DA owns the architectural gate for these files — see [DA-REVIEW.md §Executable markdown](DA-REVIEW.md#executable-markdown); this section is the line-level companion.)

- **Control flow completeness** — does every conditional path (if/else, success/failure, found/not-found) have an explicit outcome? Look for steps that warn but don't stop, then fall through to a success message.
- **Parameterised values** — are hardcoded values (thresholds, package names, paths) correct for every path the file can take?
- **Post-rename sweep** — after renaming a command, persona, or section, grep all workflow files, help text, and descriptions for the old name.
- **Multi-mode simulation** — if a file can be invoked with different inputs (a persona prompt handling different message types, a skill handling different flags), mentally execute it with each input. Does every instruction still make sense? Does the output format work for all cases?
- **Table column alignment** — markdown tables rendered by Prettier may have different column widths than hand-written ones. Run `pnpm format` before checking table rendering.
- **Output content read-aloud** — for every user-facing output block (a persona's Slack reply, an error message), read it as if you're the person seeing it for the first time. Ask: "do I know what happened, or what to do next?"

### Structural traps in workflow markdown

- **GFM table cells escape pipes** — regexes with `|` (alternation) inside markdown table cells get auto-escaped by Prettier to `\|`. The LLM reads this as a literal pipe, not alternation. Fix: pull regexes with pipes out of the table into a separate paragraph.
- **Nested backticks inside bold spans** — nesting inline code inside `**...**` trips Prettier's formatter, silently rewriting the file on every save. Fix: drop the outer bold; use single bold words or a separate sentence.

## Carried-over content

- Do hardcoded version numbers match the repo's config? (`engines.node`, `packageManager` in root `package.json`)
- Do markdown code fences open and close with the same number of backticks?

## Consistency

- Are constants duplicated across files? (single source of truth — `grep` for the value)
- Are imports unused?
- Was the same fix applied everywhere it's needed? (don't fix helpers but miss test files)
- Do config options extend defaults rather than replacing them?
- Do docs reference files that only exist in memory (`~/.claude/projects/`) but not in the repo? Contributors can't see memory files.
- Do markdown links in tracked docs resolve from the GitHub-web reading context? A link to a gitignored path (`.claude/research/...`) will 404 on github.com even if the file exists locally. Either link to a tracked path, use a plain backtick reference, or explicitly note the path is local-only.
- When referencing files in prose, do path prefixes match other references to the same file in the same document?
- Are labels/identifiers used as grep anchors unique within the file? (heading IDs, chunk numbers in status tables — duplicates break grep-based navigation)
- Do cross-document citations use section names or heading anchors (e.g. `DA-REVIEW.md §Schema-pair check`) rather than line numbers? Line numbers go stale as soon as the target file is edited — section names survive churn. Line-number refs are fine only for same-file or same-diff references where the author controls both sides.
- After renaming a config key or constant, are all references updated? (not just the definition)
- When a diff adds or modifies more than one section of a single doc, re-read each new/edited passage against every other new/edited passage in the same diff. Absolute phrases ("no X exists," "X is the only Y," "every package," "for one of N reasons") introduced in one section frequently contradict another section.
- When a PR adds a new consistency/cross-section rule, apply that rule to the PR's own draft before opening — exhaustively, as a pre-commit step. Authoring a rule and then passing the draft through it manually catches the self-referential misses that a retroactive DA pass would otherwise find. Companion: [DA-REVIEW.md §Cross-doc consistency sweep](DA-REVIEW.md#cross-doc-consistency-sweep) covers the cross-file version of the same discipline.

## Lint-staged safety

- Do test helper return types expose mutable collections (`Map`, `Set`, `Array`)? `eslint --fix` auto-converts them to `ReadonlyMap`/`ReadonlySet`/`ReadonlyArray`, breaking `.set()`/`.add()`/`.push()` calls. Use accessor methods instead.
- After writing a new test file, run `pnpm eslint --fix <file> && pnpm typecheck` to verify lint-staged won't break it on commit.

## Monorepo-specific

- Are cross-package imports using the package name (`@moe/core`), not relative paths (`../../core/`)?
- If the diff adds a cross-package export, is it added to the package-entry `src/index.ts`?
- Does changing a shared type in `core` break downstream packages? Run `pnpm build` to verify.
- Do new modules respect the dependency direction? (`core` ← `memory`/`agents`/`slack`/`github` ← `apps/server` — see `docs/CONVENTIONS.md` §Architecture Enforcement)

## Folder structure

- If the diff adds a new **concept folder** (one that groups source code by domain concept, not a build-system/runtime boundary folder), does it meet the wrapper/grouping test? Wrapper = ≥2 source files implementing one concept. Grouping = multiple related concepts under a ubiquitous-language name. Single-file concepts stay flat.
- No new internal `index.ts` barrel added — only the package-entry `src/index.ts` is a re-export barrel.
- New entries in `shared/` have 2+ sibling consumers at introduction. No `utils/` junk drawers.

## Public API surface

- Are new exports from a package-entry `src/index.ts` genuinely cross-package public API, or internal modules that intra-package code should consume via a relative import instead?
- Are options types (e.g. a future `FetchOpts`, `TransitionOpts`) exported? They should stay internal unless consumed outside the file.
- If two modules export the same symbol name, is the collision resolved at the import site (`import { getPackageName as getAgentsPackageName }`) or via a source-file rename?

### TSDoc scope

SELF-REVIEW owns the **file-level walk across touched functions** (each new/edited function's TSDoc is up to spec, no signature-restating prose, immediately above its export). DA owns the **architectural gate** (is this symbol actually public API? Is TSDoc at the declaration site, not a re-export barrel? Is the WHY non-obvious enough to warrant TSDoc on an internal?).

- When editing a function in a TSDoc-covered file, is that function's TSDoc brought up to spec? Don't skip it for functions you ARE touching.
- No signature-restating TSDoc (`@param name - The name`). Delete when touching a covered file.
- TSDoc sits immediately above its `export` — no blank line between.

## External API integration patterns

Applies once Slack/GitHub integration code lands (Stage 2+). See `docs/CONVENTIONS.md` §External API Integration Patterns for the authoritative rules — this is the line-level check, not a separate policy.

- Are header/auth builders reused? (one function per integration builds the authenticated client — audit for a call site that manually constructs auth instead)
- Are all API responses schema-validated with `.safeParse()`? No raw `as` casts on external API data without a comment justifying why a schema can't be used
- Is cache invalidation clean? Use a `refresh` param on a `Cached<T>`, not sentinel values or `as unknown` casts

## Security / robustness (line-level)

- Is `execSync` used with string interpolation? (use `execFileSync` with argument arrays)
- Are test credential values constructed at runtime where needed, not hardcoded strings a secret scanner would flag?
- Is `existsSync` followed by a read/write on the same path? That's a TOCTOU race — wrap the read/write in a try/catch instead
- Do catch blocks only swallow expected error codes? (e.g. only `ENOENT`, not `EACCES`/`EPERM` — unexpected filesystem states should fail loud)
- Does metadata/logging accurately reflect what actually happened? If operations can be skipped, track successes and report those, not the input list

## Config inheritance

- Did changing a config file affect other configs that extend it? Each package's `tsconfig.build.json` extends its own `tsconfig.json`, which extends the root `tsconfig.base.json` directly — the root's separate `tsconfig.json` (which itself extends `tsconfig.base.json` too) exists only so typescript-eslint's `projectService` can type-check root-level loose files like `eslint.config.ts`; packages don't extend it
- Did changing a shared ESLint rule affect the test-file override block in `eslint.config.ts`?

---

## See also

- [DA-REVIEW.md](DA-REVIEW.md) — architectural and comment/doc layer review (DA owns), Red Flags, Required disciplines, Severity Labels
- `docs/DEVELOPMENT.md` — full review gate flow
- `docs/TESTING.md` — test disciplines, test anti-patterns
- `docs/RATIONALIZATIONS.md` — anti-rationalization index
