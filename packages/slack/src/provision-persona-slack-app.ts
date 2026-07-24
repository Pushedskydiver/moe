import type { PersonaId } from '@moe/core';

import { buildPersonaSlackManifest } from './build-persona-slack-manifest.js';

type ManifestApiResponse = {
  readonly ok: boolean;
  readonly error?: string;
  readonly errors?: readonly { readonly message: string }[];
};

type ManifestCreateResponse = ManifestApiResponse & {
  readonly app_id?: string;
  readonly credentials?: {
    readonly client_id?: string;
    readonly signing_secret?: string;
  };
  readonly oauth_authorize_url?: string;
};

export type ManifestClient = {
  readonly apps: {
    readonly manifest: {
      readonly validate: (args: {
        readonly manifest: string;
      }) => Promise<ManifestApiResponse>;
      readonly create: (args: {
        readonly manifest: string;
      }) => Promise<ManifestCreateResponse>;
    };
  };
};

export type ProvisionedPersonaSlackApp = {
  readonly personaId: PersonaId;
  readonly appId: string;
  readonly clientId: string;
  readonly signingSecret: string;
  readonly oauthAuthorizeUrl: string;
};

export type ProvisionPersonaSlackAppResult =
  | { readonly ok: true; readonly app: ProvisionedPersonaSlackApp }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind:
          'validation-failed' | 'creation-failed' | 'incomplete-response';
        readonly message: string;
      };
    };

function validationErrorMessage(validation: ManifestApiResponse): string {
  if (validation.error !== undefined) return validation.error;
  const issueMessages = (validation.errors ?? [])
    .map((issue) => issue.message)
    .join('; ');
  return issueMessages !== '' ? issueMessages : 'manifest failed validation';
}

// Extracted purely to stay under `max-lines-per-function`/`complexity` — parses a successful
// `apps.manifest.create` response into the fields this codebase actually needs, failing loudly
// (rather than silently narrowing to `undefined`) if the real API ever omits one of them.
function parseCreationResponse(
  creation: ManifestCreateResponse,
  personaId: PersonaId,
): ProvisionPersonaSlackAppResult {
  const {
    app_id: appId,
    credentials,
    oauth_authorize_url: oauthAuthorizeUrl,
  } = creation;
  const isIncomplete =
    appId === undefined ||
    credentials?.client_id === undefined ||
    credentials.signing_secret === undefined ||
    oauthAuthorizeUrl === undefined;
  if (isIncomplete) {
    return {
      ok: false,
      error: {
        kind: 'incomplete-response',
        message: 'apps.manifest.create response was missing a required field',
      },
    };
  }

  return {
    ok: true,
    app: {
      personaId,
      appId,
      clientId: credentials.client_id,
      signingSecret: credentials.signing_secret,
      oauthAuthorizeUrl,
    },
  };
}

type ValidateResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: 'validation-failed';
        readonly message: string;
      };
    };

// Extracted so a thrown `validate` failure (Tier 3, cheap, no app created) is never mislabeled
// `creation-failed` (Tier 1, the scarce budget, an app may already exist) — DA review's own
// MATERIAL finding, since the printed/logged error kind is what tells Alex whether a failed run
// actually spent any of the ~1/min `create` budget. A separate try/catch per stage, not one
// wrapping both calls, is what keeps that distinction real rather than incidental.
async function runValidation(
  client: ManifestClient,
  manifestJson: string,
): Promise<ValidateResult> {
  try {
    const validation = await client.apps.manifest.validate({
      manifest: manifestJson,
    });
    return validation.ok
      ? { ok: true }
      : {
          ok: false,
          error: {
            kind: 'validation-failed',
            message: validationErrorMessage(validation),
          },
        };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'validation-failed',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Provisions one persona's real Slack app via `apps.manifest.validate` → `create` (BUILD_PLAN
 * 5.1) — a Tier-3 (~50/min) call spent to avoid burning `create`'s own scarce Tier-1 (~1/min)
 * budget on a manifest that fails schema checks. Takes a structural subset of `WebClient` (not
 * the class itself), same reasoning as `post-message.ts`/`add-reaction.ts`: the real client always
 * throws a `WebAPIPlatformError` on a Slack-reported error rather than resolving `{ ok: false }`,
 * so in production every rejection flows through the `catch` branch; the `response.ok` checks
 * exist for the structural contract, not because `@slack/web-api` uses them. `apps.manifest.create`
 * never returns a bot token or app-level token (docs.slack.dev/reference/methods/apps.manifest.create,
 * verified live 2026-07-24) — those require Alex's own manual OAuth-install and app-level-token
 * generation afterward, which this function deliberately doesn't attempt.
 */
export async function provisionPersonaSlackApp(
  client: ManifestClient,
  personaId: PersonaId,
): Promise<ProvisionPersonaSlackAppResult> {
  const manifestJson = JSON.stringify(buildPersonaSlackManifest(personaId));

  const validated = await runValidation(client, manifestJson);
  if (!validated.ok) return validated;

  try {
    const creation = await client.apps.manifest.create({
      manifest: manifestJson,
    });
    if (!creation.ok) {
      return {
        ok: false,
        error: {
          kind: 'creation-failed',
          message: creation.error ?? 'unknown error',
        },
      };
    }
    return parseCreationResponse(creation, personaId);
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'creation-failed',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
