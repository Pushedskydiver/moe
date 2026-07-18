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
export type {
  CostCapConfig,
  ParseCostCapConfigResult,
} from './cost-cap-config.js';
export { parseCostCapConfig } from './cost-cap-config.js';
export type { CostCapEvaluation } from './evaluate-cost-cap.js';
export { evaluateCostCap } from './evaluate-cost-cap.js';
export type {
  ClassifyMessageConfidenceParams,
  ClassifyMessageConfidenceResult,
  MessageClassification,
} from './classify-message-confidence.js';
export { classifyMessageConfidence } from './classify-message-confidence.js';
export type { ParseChannelScopeConfigResult } from './channel-scope-config.js';
export { parseChannelScopeConfig } from './channel-scope-config.js';
