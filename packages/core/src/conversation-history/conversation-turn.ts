import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const contentSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'content must not be blank');

export const conversationTurnSchema = z.object({
  id: z.uuid(),
  personaId: z.string().min(1),
  channelId: z.string().min(1),
  threadKey: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: contentSchema,
  createdAt: z.date(),
});

export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
