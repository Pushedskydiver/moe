export type SenderTriggerCache = {
  // Atomic check-then-record, not two separate `hasTriggered`/`recordTrigger` calls — a caller
  // that split them could race between the check and the record (moot for a single in-process
  // synchronous `Map`, but avoids the shape encouraging that split at all) and, unlike
  // `SeenEventCache`'s own separate `hasSeen`/`markSeen`, there is no case here where a caller
  // ever wants to check without also recording, or record without having just checked. Returns
  // `true` when this exact (persona, channel, sender) triple already triggered within the
  // window — the caller should block; a `false` result has already recorded this trigger, so an
  // immediately-following duplicate call would itself return `true`.
  readonly checkAndRecord: (input: {
    readonly personaId: string;
    readonly channelId: string;
    readonly userId: string;
  }) => boolean;
};

// Alex settled (`AskUserQuestion`, BUILD_PLAN 5.3a, 2026-07-29): a 15-minute window, second
// trigger blocks — tight enough to catch rapid-fire repetition (the clearest squeaky-wheel case)
// without risking a false positive on someone raising a genuinely separate issue hours apart.
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Suppresses a repeated High/Mid-band trigger from the same sender in the same channel within a
 * trailing window (`evaluateSenderFrequencyGuard`, `standing-proactive-guards.ts`) — the
 * BUILD_PLAN 5.3a squeaky-wheel guard the PM-persona research surfaced (message frequency/
 * repetition alone shouldn't raise triage confidence or trigger repeated action, evidenced
 * independently in both LLM-sycophancy and PM-industry-practice research; full findings:
 * `.claude/research/pm-persona-landscape/landscape-survey.md`). Scoped to the exact
 * (personaId, channelId, userId) triple, per Alex's own settled scope — a different channel or a
 * different persona's own cascade gets its own independent cooldown, and a different sender in
 * the same channel is never suppressed by someone else's trigger.
 *
 * **The cooldown starts when the guard is *passed*, not when a draft/question is actually
 * posted** (DA review) — a caller whose first High-band message never posted at all (a cost-cap
 * halt, an off-hours block, a considered `appropriate: false` verdict, or a composition failure)
 * still starts the window, so a second, genuinely different message from that same sender minutes
 * later is suppressed too. This matches Alex's own "second trigger blocks" framing literally — a
 * *trigger* is a message reaching High/Mid band, not a successful post — and the suppressed
 * message still survives via the 3.5 sweep digest either way, so nothing is silently lost by this
 * reading.
 *
 * In-memory, not persisted — the same trade-off `packages/slack/src/seen-event-cache.ts` already
 * makes and documents: no migration, no write on the hot path of every inbound message, at the
 * cost of losing state across a process restart. That gap is a strictly smaller risk here than it
 * is for `SeenEventCache`'s own Slack-redelivery dedup: this guard's purpose is reducing noise
 * from a burst of near-identical triggers, not a correctness guarantee, so a restart mid-window
 * occasionally letting one extra trigger through is an acceptable, low-stakes trade-off rather
 * than a bug — a persisted table would be real, unwarranted complexity for what this needs to do.
 * `now` is an injected clock (`docs/TESTING.md`'s "mock time" boundary), matching
 * `SeenEventCache`'s own precedent exactly.
 */
class SenderTriggerCacheImpl implements SenderTriggerCache {
  readonly #triggeredAtMs = new Map<string, number>();

  constructor(
    private readonly windowMs: number,
    private readonly now: () => number,
  ) {}

  readonly checkAndRecord = (input: {
    readonly personaId: string;
    readonly channelId: string;
    readonly userId: string;
  }): boolean => {
    this.#prune();
    const key = `${input.personaId}:${input.channelId}:${input.userId}`;
    const blocked = this.#triggeredAtMs.has(key);
    if (!blocked) {
      this.#triggeredAtMs.set(key, this.now());
    }
    return blocked;
  };

  #prune(): void {
    const currentNow = this.now();
    Array.from(this.#triggeredAtMs.keys())
      .filter(
        (key) =>
          currentNow - (this.#triggeredAtMs.get(key) ?? 0) >= this.windowMs,
      )
      .forEach((key) => this.#triggeredAtMs.delete(key));
  }
}

export function createSenderTriggerCache(opts?: {
  readonly windowMs?: number;
  readonly now?: () => number;
}): SenderTriggerCache {
  return new SenderTriggerCacheImpl(
    opts?.windowMs ?? DEFAULT_WINDOW_MS,
    opts?.now ?? Date.now,
  );
}
