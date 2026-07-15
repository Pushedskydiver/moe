import { UnrecoverableSocketModeStartError } from '@slack/socket-mode';
import {
  WebAPIHTTPError,
  WebAPIPlatformError,
  WebAPIRequestError,
} from '@slack/web-api';

const UNRECOVERABLE_PLATFORM_ERRORS: readonly string[] = Object.values(
  UnrecoverableSocketModeStartError,
);

/**
 * Mirrors @slack/socket-mode's own internal `retrieveWSSURL()` recoverability check (verified
 * against its source — not exposed as a public API): true for a permanent misconfiguration (bad
 * app token, revoked auth, disabled account/team — the SDK never retries these on its own) or a
 * request/HTTP-level failure the SDK also declines to retry; false for anything the SDK's own
 * auto-reconnect already handles. A caller uses this to decide whether the process should exit
 * (and let the platform's restart supervisor take over) rather than sit "healthy" while unable to
 * ever receive a Slack message again.
 */
export function isUnrecoverableStartError(error: unknown): boolean {
  if (error instanceof WebAPIPlatformError) {
    return UNRECOVERABLE_PLATFORM_ERRORS.includes(error.data.error);
  }
  return (
    error instanceof WebAPIRequestError || error instanceof WebAPIHTTPError
  );
}
