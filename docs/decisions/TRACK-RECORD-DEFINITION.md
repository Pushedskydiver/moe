---
status: Decided
date: 2026-07-12
---

# Track-Record Definition

## Decision

Closes VISION §8.1's open definitional question with four discrete calls: **minimum-across-directories** for multi-directory diffs, **preserve on git-detected rename**, **no transfer to brand-new directories**, and **N = 5** consecutive unreverted merges as the track-record threshold.

## Context

VISION §8.1 makes "track record" directory-scoped and lets it shift a change down at most one tier (never into Tier 3), but left undefined: what happens to a diff spanning multiple directories within one package (short of the existing package-boundary rule that already routes cross-package diffs to Tier 2), a directory rename/move, or a brand-new directory — plus the exact threshold N. These aren't edge cases; they're common in ordinary software work, and the tier model isn't buildable for the common case without them. Decided directly with Alex (four discrete choices, each with alternatives put forward), not researched — this is a policy call, not a fact to discover.

## Decisions

1. **Multi-directory diffs — minimum across touched directories.** A diff's tier is bounded by whichever touched directory has the _least_ track record. Track record in one directory doesn't transfer to another the persona hasn't proven itself in — treating the whole diff as trustworthy because one touched directory is would undercut the tier model's own logic, and echoes the Replit incident's root cause (§8.1's own citation): permission scope broader than the task actually warranted. Rejected: automatic Tier 2 for any multi-directory diff (simpler, but throws away real signal when track record differs sharply — e.g. 40 clean merges in one directory, 2 in another); primary-directory-by-LOC (rejected outright — lets a small, dangerous edit, e.g. a migration, hide behind a large low-risk change elsewhere in the same diff).
2. **Rename/move — preserve on git-detected rename.** If git's own rename detection (its standard similarity-index heuristic) flags a path change as a rename, track record carries over unchanged. The code substance didn't change; resetting it would punish routine, healthy refactors and cuts against §8.2's own framing of revocation as _mechanical_, not discretionary — a rename isn't a revocation. Uses an already-standard, mechanically computable signal rather than inventing new git-adjacent tooling. Rejected: always reset to zero (overcorrects — same code, new path, shouldn't lose earned trust); preserve-but-capped-at-Tier-2-for-a-probation-window (real option, but adds a second timer/state machine for a case git's own detection already handles cleanly).
3. **Brand-new directory — no transfer, always Tier 2 floor.** A brand-new directory always starts at Tier 2 minimum via the existing "path with no track record" clause already in §8.1's table — this decision confirms that explicitly rather than leaving it ambiguous, rather than inventing new mechanics. Rejected: one-time partial concession based on package-level history (real option, but "track record is directory-scoped" is already §8.1's foundational premise; carving an exception here would quietly soften that premise the first time it's inconvenient).
4. **Threshold N = 5.** Five consecutive unreverted merges in a directory before a tier shifts down one level. A middle ground: meaningful enough to demonstrate real reliability, short enough that steady work in one area earns trust within roughly a normal sprint's worth of ticket flow. Rejected: N = 3 (faster, but a short streak reads as reliability too easily); N = 10 (more conservative, but especially punishing for low-traffic directories that may not see 10 merges for a long time).

## Deferred / explicitly rejected

- Per-project rules of engagement and any per-persona tuning of N are out of scope here — deferred with the rest of multi-project posture (VISION §3.4).
- No change to the Tier 3 floor: track record still never buys a sensitive-path change out of mandatory named-owner review, regardless of how these four calls interact with it.

## Triggers for re-evaluation

- Once Stage 5's first 5.3 sub-chunk (or later real usage) shows N = 5 is miscalibrated — either tier concessions arrive too easily (raise N) or genuinely reliable personas wait too long for routine work (lower N).
- If git's rename-detection heuristic proves too permissive or too strict in practice for this repo's actual diff shapes (e.g. large mechanical renames the default similarity threshold misses).
- If a real multi-directory diff pattern emerges that the minimum-across-directories rule handles badly (e.g. a mechanical repo-wide rename touching many directories at once, none individually risky).

## References

- `docs/VISION.md` §8.1 (Risk tiers) and §8.2 (Cross-cutting rules) — the table and open question this ADR resolves.
- `BUILD_PLAN.md` chunk 1.5 — this chunk. Blocks chunk 1.6 (`classifyRiskTier` pure-function implementation).
