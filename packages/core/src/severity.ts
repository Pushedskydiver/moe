import { z } from 'zod';

/** How urgent/impactful the underlying work is — independent of the risk-tier autonomy gate (VISION §8.1), a different axis entirely. */
export const severitySchema = z.enum(['Critical', 'High', 'Medium', 'Low']);

export type Severity = z.infer<typeof severitySchema>;
