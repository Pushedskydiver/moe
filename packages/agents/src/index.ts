export function getPackageName(): string {
  return '@moe/agents';
}

export type {
  ParsePersonaConfigResult,
  PersonaConfig,
  PersonaId,
} from './persona-config.js';
export { parsePersonaConfig } from './persona-config.js';

export type {
  AnthropicConfig,
  ParseAnthropicConfigResult,
} from './anthropic-config.js';
export { parseAnthropicConfig } from './anthropic-config.js';
export { createAnthropicClient } from './create-anthropic-client.js';
export type {
  GenerateReplyParams,
  GenerateReplyResult,
  GenerateReplyToolUse,
  GenerateReplyUsage,
} from './generate-reply.js';
export { generateReply } from './generate-reply.js';
export {
  buildPersonaSystemPrompt,
  PLACEHOLDER_SYSTEM_PROMPT,
} from './placeholder-system-prompt.js';
export type { GatedReplyEvidence } from './compose-gated-reply.js';
export { composeGatedReply } from './compose-gated-reply.js';
export { STATUS_CLAIM_TOOL } from './status-claim-tool.js';
export { sonnetCostUsdMicros } from './model-pricing.js';
