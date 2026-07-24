import type { PersonaId } from '@moe/core';

import { PERSONA_ROSTER } from '@moe/core';

/**
 * Every bot scope the codebase actually needs, consolidated from real API calls
 * (`chat.postMessage`, `reactions.add`, `auth.test`, `users.profile.get`) and from
 * config-only requirements with no direct call site (`reactions:read` for the `reaction_added`
 * event subscription below, `channels:read` alongside `channels:history` for the ambient-channel
 * classifier gate) — three of these (`reactions:write`, `reactions:read`, `channels:read`) were
 * only ever discovered live against Sarah's real app via `missing_scope` errors (BUILD_PLAN
 * 3.4a-iii, 3.3), not visible from a pure code read. `mpim:history` is deliberately excluded —
 * `raw-message-event.ts`'s own comment confirms Sarah's app has never had it.
 */
export const PERSONA_SLACK_BOT_SCOPES: readonly string[] = [
  'chat:write',
  'reactions:write',
  'reactions:read',
  'users.profile:read',
  'im:history',
  'channels:history',
  'groups:history',
  'channels:read',
];

/** The only two Events API types the socket-mode listener actually subscribes to (`socket-mode-listener.ts`), scoped to the channel types `raw-message-event.ts` processes (`im`/`channel`/`group`, not `mpim`/`app_home`). */
export const PERSONA_SLACK_BOT_EVENTS: readonly string[] = [
  'message.im',
  'message.channels',
  'message.groups',
  'reaction_added',
];

export type SlackAppManifest = {
  readonly display_information: {
    readonly name: string;
    readonly description: string;
  };
  readonly features: {
    readonly bot_user: {
      readonly display_name: string;
      readonly always_online: boolean;
    };
  };
  readonly oauth_config: {
    readonly scopes: {
      readonly bot: readonly string[];
    };
  };
  readonly settings: {
    readonly event_subscriptions: {
      readonly bot_events: readonly string[];
    };
    readonly socket_mode_enabled: true;
    readonly org_deploy_enabled: false;
  };
};

/**
 * One manifest template (BUILD_PLAN 5.1) looped over the roster — every field but
 * `display_information`/`features.bot_user` is identical across all 8 personas, since they run
 * the same codebase (VISION §6.6: one Slack App + Bot User per persona, not a shared app). No
 * `settings.event_subscriptions.request_url` — Socket Mode delivers events over the app-token
 * WebSocket (`create-slack-clients.ts`), not a Request URL.
 *
 * NOT independently verified against Sarah's own real, currently-working manifest — do that via
 * `apps.manifest.export` before actually provisioning the other 7 apps, given three of the scopes
 * above were only ever discovered live, never from a code read alone.
 */
export function buildPersonaSlackManifest(
  personaId: PersonaId,
): SlackAppManifest {
  const persona = PERSONA_ROSTER[personaId];

  return {
    display_information: {
      name: persona.displayName,
      description: `${persona.displayName} (${persona.role}) — Moe's AI teammate system.`,
    },
    features: {
      bot_user: {
        display_name: persona.displayName,
        always_online: true,
      },
    },
    oauth_config: {
      scopes: {
        bot: PERSONA_SLACK_BOT_SCOPES,
      },
    },
    settings: {
      event_subscriptions: {
        bot_events: PERSONA_SLACK_BOT_EVENTS,
      },
      socket_mode_enabled: true,
      org_deploy_enabled: false,
    },
  };
}
