export type ThreadQueue = {
  readonly run: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
};

// A class, not a closure over a module-level `let`, per `docs/CONVENTIONS.md`'s "Cache via a
// `Cached<T>` class" rule.
class ThreadQueueImpl implements ThreadQueue {
  // One entry accumulates per distinct thread key for the process's lifetime — no eviction.
  // Each entry is a tiny settled-promise reference, so this grows slowly; acceptable for now,
  // worth revisiting if a persona process's uptime and thread-key cardinality both grow large.
  readonly #tails = new Map<string, Promise<unknown>>();

  readonly run = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const previousTail = this.#tails.get(key) ?? Promise.resolve();
    const result = previousTail.then(fn, fn);
    // Stored only to sequence the *next* call for this key — must never itself reject, or a
    // failed call would poison every later call for the same key. The real outcome (including a
    // rejection) still reaches this call's own caller via the returned `result` below.
    this.#tails.set(
      key,
      result.catch(() => undefined),
    );
    return result;
  };
}

/**
 * Serializes concurrent calls that share a `key` while letting different keys run fully
 * concurrently — closes the race BUILD_PLAN 2.4b's history fetch/persist would otherwise hit when
 * two Slack messages for the same thread arrive close together (`packages/slack`'s socket-mode
 * listener doesn't await `onMessage`, so overlapping calls are possible). Since BUILD_PLAN 3.3,
 * every call into this queue is a DM (`handle-inbound-message.ts` routes ambient channel/group
 * messages to a separate classify-and-log path that never touches this queue at all).
 */
export function makeThreadQueue(): ThreadQueue {
  return new ThreadQueueImpl();
}
