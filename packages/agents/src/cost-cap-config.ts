import { z } from 'zod';

const costCapConfigSchema = z.object({
  // The raw env var is a human dollar amount ("50", "12.50") — converted to micro-USD (USD ×
  // 1,000,000) once here, at the config boundary, so every downstream comparison against
  // `@moe/core`'s persisted `costUsdMicros` totals is already unit-matched, integer arithmetic.
  monthlyCapUsdMicros: z.coerce
    .number()
    .positive()
    .transform((dollars) => Math.round(dollars * 1_000_000)),
  alertSlackUserId: z.string().min(1),
});

export type CostCapConfig = z.infer<typeof costCapConfigSchema>;

export type ParseCostCapConfigResult =
  | { readonly ok: true; readonly config: CostCapConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-config';
        readonly issues: readonly string[];
      };
    };

/**
 * Pure boundary parser — takes an env-shaped record (the caller reads `process.env`, this
 * function never does) and validates it into a `CostCapConfig` (BUILD_PLAN 2.6b). Same
 * `parsePersonaConfig`/`parseAnthropicConfig` shape and precedent. `MOE_COST_ALERT_SLACK_USER_ID`
 * is a Slack user ID, not a channel — `postMessage` opens/posts into a DM when given one, per
 * Slack's own `chat.postMessage` semantics, no separate DM-opening call needed.
 */
export function parseCostCapConfig(
  env: Readonly<Record<string, string | undefined>>,
): ParseCostCapConfigResult {
  const parsed = costCapConfigSchema.safeParse({
    monthlyCapUsdMicros: env.MOE_COST_CAP_MONTHLY,
    alertSlackUserId: env.MOE_COST_ALERT_SLACK_USER_ID,
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
