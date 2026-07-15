import { z } from 'zod';

const personaIdSchema = z.enum([
  'sarah',
  'marcus',
  'riley',
  'priya',
  'dom',
  'theo',
  'nia',
]);

/** The seven confirmed roster IDs (`docs/decisions/CAST-ROSTER.md`, VISION §4.1). Designer excluded — deferred to the 5.0 gate. */
export type PersonaId = z.infer<typeof personaIdSchema>;

const personaConfigSchema = z.object({
  id: personaIdSchema,
  slackBotToken: z.string().min(1),
  slackSigningSecret: z.string().min(1),
});

export type PersonaConfig = z.infer<typeof personaConfigSchema>;

export type ParsePersonaConfigResult =
  | { readonly ok: true; readonly config: PersonaConfig }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-config';
        readonly issues: readonly string[];
      };
    };

/**
 * Pure boundary parser — takes an env-shaped record (the caller reads `process.env`, this
 * function never does) and validates it into a `PersonaConfig`. Kept env-var-named rather than
 * camelCase-named at the input boundary so a caller can pass `process.env` directly.
 */
export function parsePersonaConfig(
  env: Readonly<Record<string, string | undefined>>,
): ParsePersonaConfigResult {
  const parsed = personaConfigSchema.safeParse({
    id: env.MOE_PERSONA_ID,
    slackBotToken: env.MOE_SLACK_BOT_TOKEN,
    slackSigningSecret: env.MOE_SLACK_SIGNING_SECRET,
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
