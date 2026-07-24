import { ENV_FILE_CONTROL_CHARACTER } from './backup-constants.js';

/**
 * Every value must be free of `\r`/`\n`/`\0` — an embedded newline would inject an arbitrary
 * extra `KEY=VALUE` line into the generated file. Throws rather than silently writing an unsafe
 * value, since by the time a value reaches this function it's expected to already be validated
 * (`parsePgEnvFromConnectionString` rejects control characters in every field it produces) — a
 * violation here is a caller bug, not an expected failure mode of this function's own domain.
 */
export function formatEnvFileContents(
  env: Readonly<Record<string, string>>,
): string {
  return `${Object.entries(env)
    .map(([key, value]) => {
      if (ENV_FILE_CONTROL_CHARACTER.test(value)) {
        throw new Error(
          `formatEnvFileContents: value for ${key} contains a control character`,
        );
      }
      return `${key}=${value}`;
    })
    .join('\n')}\n`;
}
