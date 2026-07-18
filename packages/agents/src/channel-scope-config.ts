import type { ChannelScopeConfig } from '@moe/core';

import { z } from 'zod';

const channelScopeEnvSchema = z.object({
  workRelevantChannelIds: z
    .string()
    .transform((raw) =>
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .refine(
      (ids) => ids.length > 0,
      'must contain at least one non-empty channel ID',
    ),
});

export type ParseChannelScopeConfigResult =
  | { readonly ok: true; readonly config: ChannelScopeConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-config';
        readonly issues: readonly string[];
      };
    };

/**
 * Pure boundary parser (same `parsePersonaConfig`/`parseCostCapConfig` shape and precedent) for
 * `@moe/core`'s `ChannelScopeConfig` (BUILD_PLAN 3.2). `MOE_WORK_RELEVANT_CHANNEL_IDS` holds real
 * Slack channel IDs — workspace-specific artifacts, so unlike `CoreHoursConfig`/`AwayKeywords`
 * there's no meaningful hardcoded default; a deployment must set this explicitly, or boot fails
 * loud (same "fail loud on missing required config" precedent as `parseCostCapConfig`) rather than
 * silently classifying nothing.
 */
export function parseChannelScopeConfig(
  env: Readonly<Record<string, string | undefined>>,
): ParseChannelScopeConfigResult {
  const parsed = channelScopeEnvSchema.safeParse({
    workRelevantChannelIds: env.MOE_WORK_RELEVANT_CHANNEL_IDS,
  });

  return parsed.success
    ? {
        ok: true,
        config: {
          workRelevantChannelIds: new Set(parsed.data.workRelevantChannelIds),
        },
      }
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
