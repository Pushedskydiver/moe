import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

const bandSchema = z.enum(['high', 'mid', 'low']);

// Every expected label is fixed in the committed JSON before any run, and nothing in this
// package writes it back: `docs/decisions/STAGE-1-CLASSIFIER.md`'s Decision 3 — an eval that
// adjusts its own ground truth to agree with the system under test measures nothing.
const classifierMessageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
  // Any one of these bands counts as a match (an ambiguous `signal` message accepts Mid or High).
  expectedBands: z.array(bandSchema).min(1),
});

const gateMessageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
  expectedAppropriate: z.boolean(),
});

function hasDistinctIds(set: {
  readonly messages: readonly { readonly id: string }[];
}): boolean {
  const ids = set.messages.map((message) => message.id);
  return new Set(ids).size === ids.length;
}

const DUPLICATE_ID_MESSAGE = 'message ids must be distinct within a set';

const classifierSetSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('classifier'),
    description: z.string().min(1),
    messages: z.array(classifierMessageSchema).min(1),
  })
  .refine(hasDistinctIds, { message: DUPLICATE_ID_MESSAGE });

const gateSetSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('gate'),
    description: z.string().min(1),
    messages: z.array(gateMessageSchema).min(1),
  })
  .refine(hasDistinctIds, { message: DUPLICATE_ID_MESSAGE });

const evalSetSchema = z.union([classifierSetSchema, gateSetSchema]);

export type ClassifierEvalSet = z.infer<typeof classifierSetSchema>;
export type GateEvalSet = z.infer<typeof gateSetSchema>;
export type EvalSet = ClassifierEvalSet | GateEvalSet;

type EvalSetError = {
  readonly kind: 'unreadable-eval-set' | 'invalid-eval-set';
  readonly message: string;
};

export type ParseEvalSetResult =
  | { readonly ok: true; readonly set: EvalSet }
  | { readonly ok: false; readonly error: EvalSetError };

export type LoadEvalSetsResult =
  | { readonly ok: true; readonly sets: readonly EvalSet[] }
  | { readonly ok: false; readonly error: EvalSetError };

// The committed sets, in the order a run and its table list them: the 3.12 addendum's 18, the
// rebuilt 24, then the safety-gate 12.
const EVAL_SET_FILES: readonly string[] = [
  'addendum-18.json',
  'rebuilt-24.json',
  'safety-gate-12.json',
];

export function parseEvalSet(raw: unknown): ParseEvalSetResult {
  const parsed = evalSetSchema.safeParse(raw);

  return parsed.success
    ? { ok: true, set: parsed.data }
    : {
        ok: false,
        error: {
          kind: 'invalid-eval-set',
          message: parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        },
      };
}

async function readEvalSet(
  dir: string,
  file: string,
): Promise<ParseEvalSetResult> {
  try {
    const raw: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'));
    return parseEvalSet(raw);
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'unreadable-eval-set',
        message: `${file}: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

/** Reads and validates every set file in `dir`, failing on the first that can't be loaded. */
export async function loadEvalSets(dir: string): Promise<LoadEvalSetsResult> {
  const results = await Promise.all(
    EVAL_SET_FILES.map((file) => readEvalSet(dir, file)),
  );
  const failure = results.find((result) => !result.ok);
  if (failure !== undefined && !failure.ok) return failure;

  return {
    ok: true,
    sets: results.flatMap((result) => (result.ok ? [result.set] : [])),
  };
}
