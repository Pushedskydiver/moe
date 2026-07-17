import type { GenerateReplyResult } from './generate-reply.js';

import { describe, expect, it } from 'vitest';

import {
  composeGatedReply,
  NOT_YET_VERIFIED_TEXT,
} from './compose-gated-reply.js';
import { STATUS_CLAIM_TOOL_NAME } from './status-claim-tool.js';

const FIXED_TIMESTAMP = '2026-07-17T09:00:00.000Z';
const now = () => FIXED_TIMESTAMP;

function okResult(
  overrides: Partial<Extract<GenerateReplyResult, { readonly ok: true }>> = {},
): Extract<GenerateReplyResult, { readonly ok: true }> {
  return { ok: true, reply: 'sure, one sec', toolUses: [], ...overrides };
}

describe('composeGatedReply', () => {
  it('returns the reply unchanged when no report_status tool call was made', () => {
    const result = okResult({ reply: 'happy to help with that' });

    expect(composeGatedReply(result, now)).toBe('happy to help with that');
  });

  it('falls back to not-yet-verified when report_status was called with no evidence', () => {
    const result = okResult({
      reply: '',
      toolUses: [
        { id: 't1', name: STATUS_CLAIM_TOOL_NAME, input: { claim: 'done' } },
      ],
    });

    expect(composeGatedReply(result, now)).toBe(NOT_YET_VERIFIED_TEXT);
  });

  it('falls back to not-yet-verified when report_status was called with a malformed (missing claim) input', () => {
    const result = okResult({
      reply: '',
      toolUses: [{ id: 't1', name: STATUS_CLAIM_TOOL_NAME, input: {} }],
    });

    expect(composeGatedReply(result, now)).toBe(NOT_YET_VERIFIED_TEXT);
  });

  it('composes a grounded claim, returning the claim text, when real evidence is supplied', () => {
    const result = okResult({
      reply: '',
      toolUses: [
        {
          id: 't1',
          name: STATUS_CLAIM_TOOL_NAME,
          input: { claim: 'tests passed' },
        },
      ],
    });

    const text = composeGatedReply(result, now, {
      toolCallId: 'toolu_01abc',
      toolOutputSnippet: '54 passed (54)',
    });

    expect(text).toBe('tests passed');
  });

  it('discards accompanying reply text in favor of the composed status outcome when report_status was also called', () => {
    const result = okResult({
      reply: 'let me check on that for you',
      toolUses: [
        { id: 't1', name: STATUS_CLAIM_TOOL_NAME, input: { claim: 'done' } },
      ],
    });

    expect(composeGatedReply(result, now)).toBe(NOT_YET_VERIFIED_TEXT);
  });

  it('ignores tool calls to other tools, returning the reply unchanged', () => {
    const result = okResult({
      reply: 'here is what I found',
      toolUses: [{ id: 't1', name: 'some_other_tool', input: {} }],
    });

    expect(composeGatedReply(result, now)).toBe('here is what I found');
  });
});
