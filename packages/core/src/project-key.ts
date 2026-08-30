import { z } from 'zod';

import { isNotBlank } from './is-not-blank.js';

/** Scopes a ticket to a project. Single-project today (chief-clancy) — cross-project arbitration is deliberately out of scope (VISION §3.4). */
export const projectKeySchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'projectKey must not be blank');

export type ProjectKey = z.infer<typeof projectKeySchema>;

/** VISION §3.4's single-project scope — not an open parameter, so a bare constant rather than config. */
export const PROJECT_KEY: ProjectKey = 'chief-clancy';
