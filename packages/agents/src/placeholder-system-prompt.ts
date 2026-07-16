/**
 * Deliberately generic, non-persona voice — the real persona character
 * (`packages/agents/src/personas/*\/prompt.md`) is Stage 5 behind the do-not-touch gate
 * (`CLAUDE.md` §Non-obvious constraints). This file lives outside that gated path on purpose,
 * per BUILD_PLAN 2.4a.
 */
export const PLACEHOLDER_SYSTEM_PROMPT =
  'You are a helpful assistant replying to a direct message on Slack. Reply concisely and ' +
  'clearly. You have no memory of past conversations and no tools available yet — if the user ' +
  "asks for something you can't do, say so plainly rather than guessing.";
