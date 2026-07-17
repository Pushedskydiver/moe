import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isNotBlank } from '../is-not-blank.js';
import { conversationTurnSchema } from './conversation-turn.js';

function validTurn(): Record<string, unknown> {
  return {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    personaId: 'sarah',
    channelId: 'C123',
    threadKey: 'dm',
    role: 'user',
    content: 'what did I just ask you?',
    createdAt: new Date('2026-07-16T09:00:00.000Z'),
  };
}

describe('conversationTurnSchema', () => {
  it('accepts a fully-populated valid turn', () => {
    const result = conversationTurnSchema.safeParse(validTurn());
    expect(result.success).toBe(true);
  });

  it('rejects a turn with an empty content string', () => {
    const result = conversationTurnSchema.safeParse({
      ...validTurn(),
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a turn with a whitespace-only content string', () => {
    const result = conversationTurnSchema.safeParse({
      ...validTurn(),
      content: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a turn with a non-uuid id', () => {
    const result = conversationTurnSchema.safeParse({
      ...validTurn(),
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a turn with an unrecognised role', () => {
    const result = conversationTurnSchema.safeParse({
      ...validTurn(),
      role: 'system',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a turn missing personaId', () => {
    const turn = validTurn();
    delete turn.personaId;
    const result = conversationTurnSchema.safeParse(turn);
    expect(result.success).toBe(false);
  });

  it('property: any turn built from valid field arbitraries always parses', () => {
    const nonBlankIdentifier = fc.string({ minLength: 1 });
    const nonBlankContent = fc.string({ minLength: 1 }).filter(isNotBlank);

    const validTurnArbitrary = fc.record({
      id: fc.uuid(),
      personaId: nonBlankIdentifier,
      channelId: nonBlankIdentifier,
      threadKey: nonBlankIdentifier,
      role: fc.constantFrom('user', 'assistant'),
      content: nonBlankContent,
      createdAt: fc.date({ noInvalidDate: true }),
    });

    fc.assert(
      fc.property(validTurnArbitrary, (fields) => {
        const result = conversationTurnSchema.safeParse(fields);
        expect(result.success).toBe(true);
      }),
    );
  });

  it('property: omitting any single required field always fails to parse', () => {
    const requiredFields = [
      'id',
      'personaId',
      'channelId',
      'threadKey',
      'role',
      'content',
      'createdAt',
    ] as const;

    fc.assert(
      fc.property(fc.constantFrom(...requiredFields), (fieldToOmit) => {
        const turn = validTurn();
        delete turn[fieldToOmit];
        const result = conversationTurnSchema.safeParse(turn);
        expect(result.success).toBe(false);
      }),
    );
  });
});
