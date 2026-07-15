import { UnrecoverableSocketModeStartError } from '@slack/socket-mode';
import {
  WebAPIHTTPError,
  WebAPIPlatformError,
  WebAPIRequestError,
} from '@slack/web-api';
import { describe, expect, it } from 'vitest';

import { isUnrecoverableStartError } from './is-unrecoverable-start-error.js';

describe('isUnrecoverableStartError', () => {
  it('returns true for a platform error carrying an unrecoverable Slack error code (e.g. invalid_auth)', () => {
    const error = new WebAPIPlatformError({
      ok: false,
      error: UnrecoverableSocketModeStartError.InvalidAuth,
    });

    expect(isUnrecoverableStartError(error)).toBe(true);
  });

  it('returns true for every documented unrecoverable code, not just invalid_auth', () => {
    Object.values(UnrecoverableSocketModeStartError).forEach((code) => {
      const error = new WebAPIPlatformError({ ok: false, error: code });
      expect(isUnrecoverableStartError(error)).toBe(true);
    });
  });

  it('returns false for a platform error carrying a recoverable/unrecognized Slack error code', () => {
    const error = new WebAPIPlatformError({ ok: false, error: 'ratelimited' });

    expect(isUnrecoverableStartError(error)).toBe(false);
  });

  it('returns true for a request-level error (network failure)', () => {
    const error = new WebAPIRequestError(new Error('ECONNRESET'));

    expect(isUnrecoverableStartError(error)).toBe(true);
  });

  it('returns true for an HTTP-level error', () => {
    const error = new WebAPIHTTPError(500, 'Internal Server Error', {});

    expect(isUnrecoverableStartError(error)).toBe(true);
  });

  it('returns false for a plain, unrelated Error', () => {
    expect(isUnrecoverableStartError(new Error('something else'))).toBe(false);
  });

  it('returns false for a non-Error value', () => {
    expect(isUnrecoverableStartError('not an error')).toBe(false);
    expect(isUnrecoverableStartError(undefined)).toBe(false);
  });
});
