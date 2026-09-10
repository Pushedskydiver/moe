import type { Anthropic } from '@anthropic-ai/sdk';

import { z } from 'zod';

export const REACT_TOOL_NAME = 'react';

// Single shared constant feeding both the JSON-schema `enum` below and `reactInputSchema`'s
// `z.enum(...)` — a duplicated literal list here and there could silently drift (R1 fold,
// BUILD_PLAN 6.1f).
const REACT_REACTIONS = ['eyes', 'white_check_mark'] as const;
export type ReactReaction = (typeof REACT_REACTIONS)[number];

/**
 * Live in `generate-and-post-reply.ts`'s real `tools` array as of BUILD_PLAN 6.1g, grounded in
 * every persona's own `prompt.md` (do-not-touch, drafted with Alex).
 */
export const REACT_TOOL: Anthropic.Tool = {
  name: REACT_TOOL_NAME,
  description:
    'Call this instead of replying with a message when a plain acknowledgement is all this ' +
    'moment needs — no new information to add, nothing for the user to read. Use "eyes" to show ' +
    'you have seen something and are on it; use "white_check_mark" to show something is ' +
    'confirmed/done and needs no further discussion. Do not call this and also write a reply — ' +
    'calling this tool replaces the reply entirely; nothing else will be posted. If you call this ' +
    'more than once, only the first call is honored.',
  input_schema: {
    type: 'object',
    properties: {
      reaction: {
        type: 'string',
        enum: [...REACT_REACTIONS],
        description:
          'The Slack reaction to add, as a Slack emoji shortcode (no colons).',
      },
    },
    required: ['reaction'],
  },
};

const reactInputSchema = z.object({ reaction: z.enum(REACT_REACTIONS) });

/**
 * Parses a `react` tool_use block's raw `input`. Returns `undefined` on a malformed/missing
 * reaction — deliberately NOT defaulted to a guessed emoji: a call site that can't tell which
 * reaction was meant should fall through to the normal reply path, not gamble on total silence
 * with the wrong (or no) emoji.
 */
export function parseReactInput(input: unknown): ReactReaction | undefined {
  const parsed = reactInputSchema.safeParse(input);
  return parsed.success ? parsed.data.reaction : undefined;
}
