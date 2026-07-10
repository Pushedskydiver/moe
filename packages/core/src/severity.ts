import { z } from 'zod';

export const severitySchema = z.enum(['Critical', 'High', 'Medium', 'Low']);

export type Severity = z.infer<typeof severitySchema>;
