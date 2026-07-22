import { describe, expect, it } from 'vitest';

import { composeExternalPostBody } from './compose-external-post-body.js';

describe('composeExternalPostBody', () => {
  it('appends the persona attribution line and the footer escape-hatch to the given body', () => {
    const result = composeExternalPostBody({
      personaId: 'sarah',
      body: 'The login page returns a 500 on submit.',
    });

    expect(result).toBe(
      [
        'The login page returns a 500 on submit.',
        '',
        '---',
        "🤖 *Sarah (PM)* — Moe's AI teammate system. This content is AI-generated.",
        'Questions or concerns? @Pushedskydiver can help.',
      ].join('\n'),
    );
  });

  it("attributes a different persona's own display name and role", () => {
    const result = composeExternalPostBody({
      personaId: 'dom',
      body: 'Approved — the diff matches the linked ticket.',
    });

    expect(result).toBe(
      [
        'Approved — the diff matches the linked ticket.',
        '',
        '---',
        "🤖 *Dom (Reviewer)* — Moe's AI teammate system. This content is AI-generated.",
        'Questions or concerns? @Pushedskydiver can help.',
      ].join('\n'),
    );
  });

  it('preserves the original body content verbatim, including multiple lines', () => {
    const body = 'Line one.\nLine two.';

    const result = composeExternalPostBody({ personaId: 'riley', body });

    expect(result.startsWith(body)).toBe(true);
  });

  it('produces the attribution block on its own when the body is empty', () => {
    const result = composeExternalPostBody({ personaId: 'nia', body: '' });

    expect(result).toBe(
      [
        '',
        '',
        '---',
        "🤖 *Nia (Scrum Master)* — Moe's AI teammate system. This content is AI-generated.",
        'Questions or concerns? @Pushedskydiver can help.',
      ].join('\n'),
    );
  });
});
