import { z } from 'zod';

const anthropicConfigSchema = z.object({
  apiKey: z.string().min(1),
});

export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>;

export type ParseAnthropicConfigResult =
  | { readonly ok: true; readonly config: AnthropicConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-config';
        readonly issues: readonly string[];
      };
    };

/**
 * Pure boundary parser — takes an env-shaped record (the caller reads `process.env`, this
 * function never does) and validates it into an `AnthropicConfig`. Separate from
 * `parsePersonaConfig`: the Anthropic API key is a single shared account credential, not a
 * per-persona one (unlike the Slack tokens), matching `DATABASE_URL`'s own separate-from-persona
 * treatment.
 */
export function parseAnthropicConfig(
  env: Readonly<Record<string, string | undefined>>,
): ParseAnthropicConfigResult {
  const parsed = anthropicConfigSchema.safeParse({
    apiKey: env.MOE_ANTHROPIC_API_KEY,
  });

  return parsed.success
    ? { ok: true, config: parsed.data }
    : {
        ok: false,
        error: {
          kind: 'invalid-config',
          issues: parsed.error.issues.map(
            (issue) => `${issue.path.join('.')}: ${issue.message}`,
          ),
        },
      };
}
