export function getPackageName(): string {
  return '@moe/agents';
}

export type {
  ParsePersonaConfigResult,
  PersonaConfig,
  PersonaId,
} from './persona-config.js';
export { parsePersonaConfig } from './persona-config.js';
