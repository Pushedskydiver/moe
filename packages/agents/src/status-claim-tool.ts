import type { Anthropic } from '@anthropic-ai/sdk';

import { z } from 'zod';

export const STATUS_CLAIM_TOOL_NAME = 'report_status';

/**
 * The tool a persona calls to make a status claim (VISION §7.6 — status claims must come from a
 * typed object, never free prose). Deliberately excludes `toolCallId`/`toolOutputSnippet` from
 * its input schema: those two fields are evidence, and evidence is assembled by our own code from
 * a real tool call this turn produced (`compose-gated-reply.ts`), never taken from the model's own
 * tool-call parameters — letting the model self-report them would make the anti-fabrication gate
 * trivially bypassable.
 */
export const STATUS_CLAIM_TOOL: Anthropic.Tool = {
  name: STATUS_CLAIM_TOOL_NAME,
  description:
    'Call this when you want to tell the user that some piece of work is done, in progress, ' +
    'or has a definite outcome — a factual claim about status, not general conversation. Do ' +
    'not state a status claim directly in your reply text; call this tool instead and let the ' +
    'system decide how to phrase it back, since it may not have evidence to back the claim yet.',
  input_schema: {
    type: 'object',
    properties: {
      claim: {
        type: 'string',
        description:
          'The status claim in plain language, e.g. "Finished updating the config file."',
      },
    },
    required: ['claim'],
  },
};

const reportStatusInputSchema = z.object({ claim: z.string() });

/**
 * Parses a `report_status` tool_use block's raw `input` (`unknown`) against the tool's own
 * declared shape. Returns `''` on a malformed or missing claim rather than throwing —
 * `composeStatus`'s own blank-claim check (chunk 1.4) already rejects an empty string, so a
 * malformed tool call converges on the same not-yet-verified fallback as a genuinely absent
 * claim, through one code path, not two.
 */
export function parseStatusClaimInput(input: unknown): string {
  const parsed = reportStatusInputSchema.safeParse(input);
  return parsed.success ? parsed.data.claim : '';
}
