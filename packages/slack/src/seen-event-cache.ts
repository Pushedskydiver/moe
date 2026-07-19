export type SeenEventCache = {
  readonly hasSeen: (eventId: string) => boolean;
  readonly markSeen: (eventId: string) => void;
  // Reverses a `markSeen` call — for when dispatch fails after an event id was marked seen but
  // before it was actually, successfully processed (DA review: marking seen unconditionally
  // before dispatch, with no way back, meant a failed attempt would silently swallow Slack's own
  // legitimate retry of that same event for the rest of the TTL window — most consequential on
  // the 🔁 redo path, which has no other retry/CAS protection at all). Callers forget only on a
  // genuine processing failure, not on a normal skip (an already-seen duplicate, a filtered-out
  // event) — see `handle-socket-mode-event.ts`/`handle-socket-mode-reaction-event.ts`'s own
  // callers for where this fires.
  readonly forget: (eventId: string) => void;
};

// Slack's own documented retry backoff for a failed/timed-out event delivery is nearly immediate,
// then +1 minute, then +5 minutes (docs.slack.dev/apis/events-api) — a real redelivery can arrive
// up to ~6 minutes after the original. 15 minutes gives comfortable margin over that without
// holding entries indefinitely.
const DEFAULT_TTL_MS = 15 * 60 * 1000;

/**
 * Tracks Slack event ids seen within a trailing TTL window, so a Socket Mode redelivery (a retry
 * after a timed-out/lost ack, or a reconnection racing an in-flight one) doesn't dispatch the same
 * event twice. Slack's own `event_id` is "globally unique" and "remains consistent across retries
 * of the same event" (docs.slack.dev/apis/events-api) — the correct dedup key; `envelope_id` is a
 * per-WebSocket-delivery-attempt id with no documented cross-retry stability guarantee, so it
 * isn't used here. In-memory, not persisted: the ~6-minute real-world retry window (see
 * `DEFAULT_TTL_MS` above) is comfortably covered by a bounded TTL, with no migration and no write
 * on the hot path of every inbound event — the only gap this leaves is a process restart landing
 * inside that window on top of an already-rare duplicate-delivery event, an intentional trade-off
 * against `docs/CONVENTIONS.md`'s "Cache via a `Cached<T>` class" pattern rather than a persisted
 * table. Genuinely mutable instance state, exempted from `eslint-plugin-functional`'s
 * `immutable-data` rule via its own `ignoreClasses` option, same reasoning as `packages/core`'s
 * own `Cached<T,E>`. `now` is an injected clock (`docs/TESTING.md`'s "mock time" boundary), not a
 * directly-called `Date.now()`, so tests can advance time deterministically.
 */
class SeenEventCacheImpl implements SeenEventCache {
  readonly #seenAtMs = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number,
  ) {}

  readonly hasSeen = (eventId: string): boolean => {
    this.#prune();
    return this.#seenAtMs.has(eventId);
  };

  readonly markSeen = (eventId: string): void => {
    this.#seenAtMs.set(eventId, this.now());
  };

  readonly forget = (eventId: string): void => {
    this.#seenAtMs.delete(eventId);
  };

  #prune(): void {
    const currentNow = this.now();
    Array.from(this.#seenAtMs.keys())
      .filter((id) => currentNow - (this.#seenAtMs.get(id) ?? 0) >= this.ttlMs)
      .forEach((id) => this.#seenAtMs.delete(id));
  }
}

export function createSeenEventCache(opts?: {
  readonly ttlMs?: number;
  readonly now?: () => number;
}): SeenEventCache {
  return new SeenEventCacheImpl(
    opts?.ttlMs ?? DEFAULT_TTL_MS,
    opts?.now ?? Date.now,
  );
}
