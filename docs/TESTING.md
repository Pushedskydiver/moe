# Testing

Test-writing discipline that complements `docs/CONVENTIONS.md` §Testing Standards (which already covers co-located flat test files, unit tests for every exported function, property-based testing via fast-check, 80% coverage, tracer-bullet TDD, and why persona-replay tests are load-bearing). This doc doesn't restate those — it covers _how to write a good test_, not what must have one.

**Adapted from chief-clancy's own `docs/TESTING.md`.** That version's Layer 2/Layer 3 sections (integration and E2E tests against real board-provider APIs — GitHub/Jira/Linear/Shortcut/Notion/Azure DevOps) describe infrastructure moe has no equivalent of; moe's own integration-test story will get written once Slack/GitHub integration code exists (Stage 2+) rather than invented now against nothing.

---

## Running tests

```bash
pnpm test                      # all packages
pnpm --filter @moe/core test   # one package
pnpm vitest run --coverage     # with coverage
```

Root `vitest.config.ts` (once one exists — today each package has its own, see `packages/core/vitest.config.ts` for the pattern) would enforce coverage thresholds across all packages; each package's own config scopes `pnpm test` to that package alone. No path-alias gotcha here — unlike chief-clancy, moe has no `~/`-style aliases to trip over (`docs/CONVENTIONS.md` §Import Ordering).

## Writing good tests

### Test state, not interactions

Assert on the **outcome** of an operation, not on which internal methods were called. Interaction-based assertions break under refactoring even when behaviour hasn't changed.

```ts
// Good: tests what the function does (state-based)
it('returns tickets sorted by creation date, newest first', async () => {
  const tickets = await listTickets({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(tickets[0].createdAt.getTime()).toBeGreaterThan(
    tickets[1].createdAt.getTime(),
  );
});

// Bad: tests how the function works internally (interaction-based)
it('calls db.query with ORDER BY created_at DESC', async () => {
  await listTickets({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(db.query).toHaveBeenCalledWith(
    expect.stringContaining('ORDER BY created_at DESC'),
  );
});
```

**Carve-out — when interaction assertions are correct:** when the interaction itself is the behaviour under test.

- Slack/GitHub API call counts (`toHaveBeenCalledTimes(N)` when "posts exactly one reply" is the behaviour)
- Call-argument assertions (asserting a Slack message was posted to the right channel, or a GitHub comment to the right PR)
- Idempotency (an operation ran once, not twice, on retry)
- Side-effect ordering (a ticket claim happened before the status post that references it)
- Retry counts (a rate-limited Slack call was retried N times)

Rule of thumb: prefer state assertions when the state is observable. Use interaction assertions when the interaction _is_ the contract.

### Mock at system boundaries only

Mock external APIs (Slack, GitHub), the filesystem (sometimes), time, randomness, and the database (sometimes — prefer a real test database where practical). Don't mock your own classes, internal collaborators, or anything you control.

Moe's canonical way to make code testable is the same DI convention `docs/CONVENTIONS.md` already states: **inject I/O functions as parameters** — pass the Slack client, pass the GitHub client, pass the DB handle. The DI boundary _is_ the test seam; a test substitutes a fake implementation there rather than mocking an internal collaborator two calls deep.

### SDK-style interfaces over generic fetchers

Prefer one specific function per external operation (`postSlackMessage`, `createGithubIssue`, `fetchTicket`) over one generic `request(endpoint, options)` with conditional logic buried in the mock. Each function call site is type-safe per operation, the mock needs no conditional branching, and a reader can see which operations a test actually exercises.

### Typed mock fetchers

```ts
// Good — typed mock, no vi.mocked() wrapper needed
const mockPostMessage = vi.fn<SlackClient['postMessage']>();

// Bad — untyped, loses call-signature checking
const mockPostMessage = vi.fn();

// Bad — annotation without the generic, same problem
const mockPostMessage: SlackClient['postMessage'] = vi.fn();
```

Fix typing findings in the same PR that surfaces them — don't defer.

### DAMP > DRY in tests

Descriptive And Meaningful Phrases beat Don't-Repeat-Yourself in test code — each test should read like a self-contained spec, even at the cost of some duplication.

```ts
it('rejects an empty ticket title', () => {
  expect(() => createTicket({ title: '' })).toThrow('title is required');
});

it('trims whitespace-only titles to empty and rejects them', () => {
  expect(() => createTicket({ title: '   ' })).toThrow('title is required');
});
```

Duplication in tests is acceptable when it makes each test independently understandable. Shared `beforeEach` setup is fine for genuinely common state; shared input shapes that obscure what each test verifies are not.

### Tests describe behaviour through public interfaces

A test that breaks on a rename with no behaviour change is testing an implementation detail, not behaviour. Verify through the function's actual public contract.

### The Durability rule

Only write assertions that would survive a radical internal rewrite — assert on observable outcomes (an API response shape, a ticket's status transition, a returned value, a Slack message's text) rather than internal state. A good test reads like a spec; a bad one reads like a diff.

### The Beyoncé Rule

If you liked it, you should have put a test on it. A refactor or migration isn't responsible for catching your bugs — your tests are.

(The state-vs-interaction distinction, mock-at-boundaries, DAMP>DRY, the Durability rule, and the Beyoncé Rule are adapted from two external skill sources chief-clancy credits: Matt Pocock's `tdd` skill and Addy Osmani's `test-driven-development` skill.)

---

## Bug fixes — the Prove-It Pattern

When a bug is reported, **do not start by trying to fix it**. Start by writing a test that reproduces it. The test must FAIL against the current code. Then fix. The test passes — proving the fix works and guarding against regression.

```
Bug report arrives
       │
       ▼
Write a test that demonstrates the bug
       │
       ▼
Test FAILS (confirming the bug exists)
       │
       ▼
Implement the fix
       │
       ▼
Test PASSES (proving the fix works)
       │
       ▼
Run the full test suite (no regressions)
```

**This composes with tracer-bullet TDD, not against it.** When the behaviour under change is a bug, the first tracer bullet _is_ the reproduction test. The vertical-slice rule still applies: write one failing reproduction test, fix it, then move to the next slice if the bug has multiple facets — don't write every failure mode as a test up front, that's horizontal slicing.

This is the discipline `docs/DA-REVIEW.md` and `docs/SELF-REVIEW.md` already forward-reference ("a reproduction test that failed before the fix") without naming — this section is that reference, now resolved.

## Test anti-patterns

| Anti-pattern                          | Problem                                                        | Fix                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Testing implementation details        | Tests break on refactor even when behaviour is unchanged       | Test inputs and outputs — see Test state, not interactions above                                         |
| Mocking internal collaborators        | Tests pass while production breaks; brittle to refactor        | Mock at system boundaries only; use DI for internal collaborators                                        |
| Flaky tests (timing, order-dependent) | Erodes trust in the whole suite                                | Deterministic assertions, isolated state, no shared state between tests                                  |
| Snapshot abuse                        | Large snapshots nobody reviews; break on any change            | Use snapshots sparingly; review every snapshot diff                                                      |
| No test isolation                     | Tests pass individually but fail together                      | Each test sets up and tears down its own state in `beforeEach`/`afterEach`                               |
| Tests that pass on first run          | May not be testing what you think                              | Verify the test would FAIL if you broke the behaviour — the Prove-It Pattern enforces this for bug fixes |
| Permissive regex assertions           | `\?d` matches bare `d`; `[^\n]*` middles allow swapped content | Walk through the simplest wrong input — see `docs/SELF-REVIEW.md` §Test permissiveness audit             |
| Bug fixes without reproduction tests  | Nothing guards against the regression coming back              | Apply the Prove-It Pattern — failing test before fix                                                     |
| Skipping tests to make the suite pass | The bug is still there, just hidden                            | Fix the test or fix the code — never `.skip` to ship                                                     |

## Adding tests

**When adding a new module:**

1. Create the module and its co-located test in the same commit.
2. Test the pure functions directly; mock only at I/O boundaries.
3. Use fast-check for parsers, serializers, and formatters (grep `fast-check` in the repo for the current list of where it's used — a maintained enumeration goes stale, the grep doesn't. Nothing uses it yet; the first parser/serializer this codebase writes is also the first real entry in that list).
4. Follow the existing package's test patterns rather than inventing a new shape.

**A PR adding a new module should include:**

- Co-located unit tests for every exported function
- At minimum, a happy-path scenario and an error/edge-case scenario per function
- Property-based tests for any parser, serializer, or formatter

## See also

- `docs/CONVENTIONS.md` §Testing Standards — coverage threshold, co-located test files, property-based testing, persona-replay tests
- `docs/DA-REVIEW.md` §Completeness, §Test permissiveness audit
- `docs/SELF-REVIEW.md` §Test accuracy, §Test permissiveness audit
- `docs/DEVELOPMENT.md` — the review gate this discipline feeds into
