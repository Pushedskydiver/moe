const REDACTED_MARKER = '[REDACTED]';

function isPlainObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively replaces the value at any key named in `secretKeys` with a fixed marker, at any
 * depth (nested objects, array elements) — so a secret field never survives into a log line
 * regardless of where in the payload it's embedded. Pure: never mutates its input.
 */
export function redactSecrets(
  value: unknown,
  secretKeys: readonly string[],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, secretKeys));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) =>
      secretKeys.includes(key)
        ? [key, REDACTED_MARKER]
        : [key, redactSecrets(entry, secretKeys)],
    ),
  );
}
