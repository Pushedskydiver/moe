type RootCandidate = {
  readonly text: string;
  readonly replyText?: string;
};

export type RootCandidateBuffer = {
  readonly recordCandidate: (
    channelId: string,
    ts: string,
    text: string,
  ) => void;
  readonly recordReply: (
    channelId: string,
    ts: string,
    replyText: string,
  ) => void;
  readonly takeIfMatches: (
    channelId: string,
    ts: string,
  ) => RootCandidate | undefined;
};

type StoredCandidate = RootCandidate & { readonly ts: string };

// A class, not a closure over a module-level `let`, per `docs/CONVENTIONS.md`'s "Cache via a
// `Cached<T>` class" rule — `eslint.config.ts`'s `functional/immutable-data` rule sets
// `ignoreClasses: true` specifically so genuinely stateful constructs like this one mutate an
// instance field rather than fight the functional-by-default lint rules meant for the rest of the
// codebase.
class RootCandidateBufferImpl implements RootCandidateBuffer {
  readonly #candidates = new Map<string, StoredCandidate>();

  readonly recordCandidate = (
    channelId: string,
    ts: string,
    text: string,
  ): void => {
    this.#candidates.set(channelId, { ts, text });
  };

  readonly recordReply = (
    channelId: string,
    ts: string,
    replyText: string,
  ): void => {
    const current = this.#candidates.get(channelId);
    if (current === undefined || current.ts !== ts) return;
    this.#candidates.set(channelId, { ...current, replyText });
  };

  readonly takeIfMatches = (
    channelId: string,
    ts: string,
  ): RootCandidate | undefined => {
    const current = this.#candidates.get(channelId);
    if (current === undefined || current.ts !== ts) return undefined;
    this.#candidates.delete(channelId);
    return {
      text: current.text,
      ...(current.replyText !== undefined
        ? { replyText: current.replyText }
        : {}),
    };
  };
}

/**
 * Single-slot-per-channel, in-memory, lost on process restart — backfills the message that opened
 * a Slack thread (never carries `thread_ts` itself, only the replies that follow do — BUILD_PLAN
 * 2.4b Design §0) without persisting every un-threaded message indefinitely. Only catches threading
 * onto the most recent un-threaded message per channel; an older one displaced from the slot is an
 * accepted residual gap. `recordReply` only attaches when `ts` still matches the live candidate —
 * closes both a cross-contamination race (a slow reply landing after a newer candidate overwrote
 * the slot) and an already-consumed race (`takeIfMatches` cleared the slot first).
 */
export function makeRootCandidateBuffer(): RootCandidateBuffer {
  return new RootCandidateBufferImpl();
}
