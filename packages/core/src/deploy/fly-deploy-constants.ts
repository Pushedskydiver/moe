// London, matching the production Neon project's own `eu-west-2` region (`docs/OPERATIONS.md`,
// BUILD_PLAN 4.6) and the team's Europe/London core hours (BUILD_PLAN 2.7a). Every persona holds
// a TCP pool against that database for the whole life of the process, so a transatlantic round
// trip would be paid on every query and every atomic ticket claim. Deliberately changed from
// chunk 2.2's original `iad`, which no doc ever justified.
export const FLY_PRIMARY_REGION = 'lhr';

// Matches `apps/server/src/resolve-port.ts`'s own default, restated here because the health check
// below has to name a concrete port and `[env]` is what pins it for the deployed process.
export const FLY_INTERNAL_PORT = 8080;

export const FLY_VM_SIZE = 'shared-cpu-1x';
export const FLY_VM_MEMORY = '256mb';

// Carried over verbatim from chunk 2.2's original `[[http_service.checks]]` block — only the
// section they live in changed (see `fly-app-config.ts`), not the timings themselves.
export const FLY_CHECK_GRACE_PERIOD = '10s';
export const FLY_CHECK_INTERVAL = '15s';
export const FLY_CHECK_TIMEOUT = '5s';

// Uppercase deliberately, despite Fly's own top-level-`[checks]` example writing `method = "get"`
// (its `[[http_service.checks]]` example writes `"GET"`). Node's HTTP parser matches methods
// case-sensitively against a known list, so a literally-lowercase `get` on the wire is rejected
// with `HPE_INVALID_METHOD` — the request never reaches `createHealthHandler` at all, failing as a
// 400 rather than falling through to its 404 branch (verified directly against Node v24 by writing
// a literal `get /health HTTP/1.1` onto a socket). Whether Fly's own checker normalizes the method
// before sending is not documented and was not verified, which is exactly why uppercase is emitted:
// it is unambiguously valid HTTP whichever end does or doesn't normalize.
export const FLY_CHECK_METHOD = 'GET';
export const FLY_CHECK_PATH = '/health';
