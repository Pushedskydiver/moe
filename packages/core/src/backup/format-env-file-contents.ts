export function formatEnvFileContents(
  env: Readonly<Record<string, string>>,
): string {
  return `${Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}
