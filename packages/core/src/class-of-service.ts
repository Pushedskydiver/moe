import { z } from 'zod';

/**
 * Kanban queue-jump treatment (BUILD_PLAN 4.5, `docs/decisions/BOARD-AND-CAPACITY-MODEL.md`) —
 * independent of `severity` (business-impact rating), a different Kanban concept entirely, though
 * `'Expedite'` eligibility is partly defined in terms of it (`severity: 'Critical'`, or sourced
 * from `#moe-incidents`).
 */
export const classOfServiceSchema = z.enum(['Standard', 'Expedite']);

export type ClassOfService = z.infer<typeof classOfServiceSchema>;
