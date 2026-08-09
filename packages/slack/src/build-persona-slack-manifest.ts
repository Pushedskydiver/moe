import type { PersonaId } from '@moe/core';

import { PERSONA_ROSTER } from '@moe/core';

/**
 * Every bot scope the codebase actually needs, consolidated from real API calls
 * (`chat.postMessage`, `reactions.add`, `auth.test`, `users.profile.get`) and from
 * config-only requirements with no direct call site (`reactions:read` for the `reaction_added`
 * event subscription below, `channels:read` alongside `channels:history` for the ambient-channel
 * classifier gate). Of these, only `users.profile:read` has a documented live-discovery trail —
 * Sarah's real app didn't have it and the first real `users.profile.get` call returned
 * `missing_scope` (BUILD_PLAN 2.7b); the other three config-only-reasoned scopes above rest on
 * that reasoning alone, not a similarly recorded discovery. `mpim:history` is deliberately
 * excluded — `raw-message-event.ts`'s own comment confirms Alex's app doesn't currently have it.
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
    readonly app_home: {
      readonly home_tab_enabled: boolean;
      readonly messages_tab_enabled: boolean;
      readonly messages_tab_read_only_enabled: boolean;
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
 * `apps.manifest.export` before actually provisioning the other 7 apps, since not every scope
 * above traces to a documented discovery (only `users.profile:read` does; the rest rest on the
 * config/call-site reasoning above, unconfirmed against a real exported manifest). The same gap
 * applies to `features.app_home` below: its field names are confirmed against Slack's own current
 * docs (docs.slack.dev/reference/app-manifest), but the whole manifest hasn't been schema-checked
 * together via a live `apps.manifest.validate` call — attempted 2026-08-09, blocked by an expired
 * `MOE_SLACK_APP_CONFIG_TOKEN` (`invalid_auth`), not by anything wrong with the manifest itself.
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
      // All three fields set explicitly rather than relying on whatever Slack's own default
      // happens to be (discovered live on Maya's app post-5.3b-deploy, 2026-08-09: Slack showed
      // Alex a real, visible "Sending messages to this app has been turned off" error when he
      // tried to DM her — an app's Messages tab defaults to read-only, which nothing in this
      // codebase's tests or manifest generation had caught before that live deploy).
      // `home_tab_enabled: false` since no persona implements a Home tab (no `app_home_opened`
      // handler or `views.publish` call exists anywhere in this codebase).
      app_home: {
        home_tab_enabled: false,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
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
