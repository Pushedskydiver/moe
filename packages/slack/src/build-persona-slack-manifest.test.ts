import { describe, expect, it } from 'vitest';

import {
  buildPersonaSlackManifest,
  PERSONA_SLACK_BOT_EVENTS,
  PERSONA_SLACK_BOT_SCOPES,
} from './build-persona-slack-manifest.js';

describe('buildPersonaSlackManifest', () => {
  it("names the app after the persona's own display name, not a shared/prefixed name", () => {
    const manifest = buildPersonaSlackManifest('sarah');

    expect(manifest.display_information.name).toBe('Sarah');
    expect(manifest.features.bot_user.display_name).toBe('Sarah');
  });

  it("composes the description from the persona's display name and role", () => {
    const manifest = buildPersonaSlackManifest('maya');

    expect(manifest.display_information.description).toBe(
      "Maya (Designer) — Moe's AI teammate system.",
    );
  });

  it('gives every persona the identical shared bot scopes and event subscriptions', () => {
    const sarah = buildPersonaSlackManifest('sarah');
    const marcus = buildPersonaSlackManifest('marcus');

    expect(sarah.oauth_config.scopes.bot).toEqual(PERSONA_SLACK_BOT_SCOPES);
    expect(marcus.oauth_config.scopes.bot).toEqual(PERSONA_SLACK_BOT_SCOPES);
    expect(sarah.settings.event_subscriptions.bot_events).toEqual(
      PERSONA_SLACK_BOT_EVENTS,
    );
    expect(marcus.settings.event_subscriptions.bot_events).toEqual(
      PERSONA_SLACK_BOT_EVENTS,
    );
  });

  it("never requests mpim:history — Sarah's real app has never had it (raw-message-event.ts)", () => {
    const manifest = buildPersonaSlackManifest('sarah');

    expect(manifest.oauth_config.scopes.bot).not.toContain('mpim:history');
    expect(manifest.settings.event_subscriptions.bot_events).not.toContain(
      'message.mpim',
    );
  });

  it('enables Socket Mode and sets no request URL (no HTTP event transport exists)', () => {
    const manifest = buildPersonaSlackManifest('riley');

    expect(manifest.settings.socket_mode_enabled).toBe(true);
    expect(manifest.settings).not.toHaveProperty(
      'event_subscriptions.request_url',
    );
  });

  it('enables the Messages tab and turns off its read-only default — Slack showed Alex a real "turned off" error when he tried to DM Maya, since a new app defaults to read-only there', () => {
    const manifest = buildPersonaSlackManifest('maya');

    expect(manifest.features.app_home.messages_tab_enabled).toBe(true);
    expect(manifest.features.app_home.messages_tab_read_only_enabled).toBe(
      false,
    );
  });

  it('disables the Home tab — no persona implements one', () => {
    const manifest = buildPersonaSlackManifest('maya');

    expect(manifest.features.app_home.home_tab_enabled).toBe(false);
  });
});
