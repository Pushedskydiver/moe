import { z } from 'zod';

import { boardStatusSchema } from './board-status.js';
import { isNotBlank } from './is-not-blank.js';
import { projectKeySchema } from './project-key.js';
import { severitySchema } from './severity.js';

const titleSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'title must not be blank');

/**
 * A work item moving through the board lifecycle (`boardStatusSchema`). Deliberately excludes
 * claim fields (`claimedBy`, a version column) — those are chunk 1.3's atomic-claim primitive,
 * not part of this pure domain shape, since there's no DB yet for a claim to be atomic against.
 */
export const ticketSchema = z
  .object({
    id: z.uuid(),
    projectKey: projectKeySchema,
    title: titleSchema,
    status: boardStatusSchema,
    severity: severitySchema,
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .refine((ticket) => ticket.updatedAt >= ticket.createdAt, {
    message: 'updatedAt must not predate createdAt',
    path: ['updatedAt'],
  });

export type Ticket = z.infer<typeof ticketSchema>;
