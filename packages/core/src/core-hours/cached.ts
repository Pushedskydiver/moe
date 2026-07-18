export type CachedFetchResult<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type CachedGetResult<T, E> =
  | { readonly ok: true; readonly value: T; readonly stale: boolean }
  | { readonly ok: false; readonly error: E };

/**
 * A cache-with-serve-stale-on-failure wrapper around a single fetch function
 * (`docs/CONVENTIONS.md`'s External API Integration Patterns: "Cache via a `Cached<T>` class") —
 * genuinely mutable instance state, exempted from `eslint-plugin-functional`'s `immutable-data`
 * rule via its own `ignoreClasses` option, since a cache is inherently local mutation.
 * `get({ refresh: true })` forces a fresh fetch instead of storing an "invalidated" sentinel
 * value, per that same doc's explicit instruction. On a failed refresh, the previous value keeps
 * serving (`stale: true` on the result) rather than surfacing the failure — unless there has
 * never been a successful fetch at all, in which case the failure surfaces, since there is
 * nothing to fall back to. `now` is an injected clock (`docs/TESTING.md`'s "mock time" boundary),
 * not a directly-called `Date.now()`, so tests can advance time deterministically.
 *
 * Deliberately not re-exported from `@moe/core`'s package entry despite being general-purpose
 * infrastructure — `bank-holidays-cache.js` is its only consumer today, and
 * `docs/CONVENTIONS.md`'s `shared/` discipline ("extract only at 2+ consumers") argues against a
 * public surface with one caller. Promote it to the package entry the day a second integration
 * (Slack, GitHub) needs the same cache-with-serve-stale-on-failure shape.
 */
export class Cached<T, E> {
  // Genuinely mutable — `get()` below reassigns both on every successful fetch. `readonly` here
  // would be actively wrong, not just unenforced: it compiles to a real TS2540 error at the
  // reassignment site, which is exactly what `functional/prefer-readonly-type`'s own `--fix`
  // introduced before this comment existed. Disabled, not restructured, because there is no
  // alternative shape that is both a cache and immutable.
  // eslint-disable-next-line functional/prefer-readonly-type
  #value: T | null = null;
  // eslint-disable-next-line functional/prefer-readonly-type
  #fetchedAtMs: number | null = null;

  constructor(
    private readonly fetchFresh: () => Promise<CachedFetchResult<T, E>>,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async get(opts?: {
    readonly refresh?: boolean;
  }): Promise<CachedGetResult<T, E>> {
    const isStale =
      this.#fetchedAtMs === null ||
      this.now() - this.#fetchedAtMs >= this.ttlMs;
    if (opts?.refresh !== true && !isStale) {
      return { ok: true, value: this.#value as T, stale: false };
    }

    const fresh = await this.fetchFresh();
    if (fresh.ok) {
      this.#value = fresh.value;
      this.#fetchedAtMs = this.now();
      return { ok: true, value: fresh.value, stale: false };
    }

    if (this.#value !== null) {
      return { ok: true, value: this.#value, stale: true };
    }
    return { ok: false, error: fresh.error };
  }
}
