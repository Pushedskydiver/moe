import { z } from 'zod';

// Mirrors the three cascade functions' real `Result` shapes (`generate-reply.ts`,
// `compose-ticket-draft.ts`, `compose-confirming-question-lead-in.ts`) closely enough to validate
// a recorded fixture at load time, without importing those hand-written TS types directly — a
// fixture is a JSON serialization, a different boundary with its own schema, per
// `docs/CONVENTIONS.md` §Zod ("derive the type from the schema"). Keep in sync if any of the three
// Result shapes changes.
const usageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheCreationInputTokens: z.number().optional(),
  cacheReadInputTokens: z.number().optional(),
});

const errorResultSchema = z.object({
  ok: z.literal(false),
  error: z.object({ kind: z.string().min(1), message: z.string() }),
});

const dmReplyOkSchema = z.object({
  ok: z.literal(true),
  reply: z.string(),
  toolUses: z.array(
    z.object({ id: z.string(), name: z.string(), input: z.unknown() }),
  ),
  usage: usageSchema,
});

const ticketDraftOkSchema = z.object({
  ok: z.literal(true),
  title: z.string(),
  body: z.string(),
  usage: usageSchema,
});

const confirmingQuestionOkSchema = z.object({
  ok: z.literal(true),
  questionLeadIn: z.string(),
  usage: usageSchema,
});

const replayResultSchema = z.union([
  dmReplyOkSchema,
  ticketDraftOkSchema,
  confirmingQuestionOkSchema,
  errorResultSchema,
]);

const replayFixtureSchema = z.object({
  scenarioId: z.string().min(1),
  personaId: z.string().min(1),
  callSite: z.enum(['dmReply', 'ticketDraft', 'confirmingQuestion']),
  promptContentHash: z.string().length(64),
  scenarioInputHash: z.string().length(64),
  model: z.string().min(1),
  recordedAt: z.string().min(1),
  stopReason: z.string().nullable(),
  outputTokensRaw: z.number().nullable(),
  result: replayResultSchema,
});

export type ReplayFixture = z.infer<typeof replayFixtureSchema>;

export type ParseReplayFixtureResult =
  | { readonly ok: true; readonly fixture: ReplayFixture }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'invalid-replay-fixture';
        readonly message: string;
      };
    };

/**
 * Validates parsed JSON against the replay-fixture schema (`docs/decisions/PERSONA-REPLAY-HARNESS.md`
 * decision 5) rather than trusting it with `as` — a fixture is written by a recording script and
 * read back by both a CI-run test and a human reviewing a diff, so a malformed file should fail
 * loudly and specifically, not surface as a confusing downstream type error.
 */
export function parseReplayFixture(data: unknown): ParseReplayFixtureResult {
  const parsed = replayFixtureSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: 'invalid-replay-fixture',
        message: parsed.error.message,
      },
    };
  }
  return { ok: true, fixture: parsed.data };
}
