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
} from './generate-reply.js';
export { generateReply } from './generate-reply.js';
export { PLACEHOLDER_SYSTEM_PROMPT } from './placeholder-system-prompt.js';
