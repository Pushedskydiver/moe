const DEFAULT_PULL_LOOP_INTERVAL_MS = 60_000;
// Node clamps any setInterval delay below 1ms to a ~1ms floor rather than firing synchronously,
// so this isn't a true busy-loop risk — but a sub-1000ms poll interval still has no valid meaning
// for this use case, unlike resolve-port.ts's PORT=0 (a genuinely valid "OS-assigned port" value
// that function deliberately preserves).
const MIN_PULL_LOOP_INTERVAL_MS = 1_000;

/**
 * Resolves the pull loop's poll interval from env, mirroring `resolve-port.ts`'s
 * `env.X !== undefined && !Number.isNaN(parsed)` idiom (the only existing precedent in this
 * codebase for an optional numeric env var with a default). `MOE_`-prefixed, unlike `PORT` —
 * this is a moe-specific product knob, not a platform convention.
 */
export function resolvePullLoopIntervalMs(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const parsed = Number(env.MOE_PULL_LOOP_INTERVAL_MS);
  const isValid =
    env.MOE_PULL_LOOP_INTERVAL_MS !== undefined &&
    !Number.isNaN(parsed) &&
    parsed >= MIN_PULL_LOOP_INTERVAL_MS;
  return isValid ? parsed : DEFAULT_PULL_LOOP_INTERVAL_MS;
}
