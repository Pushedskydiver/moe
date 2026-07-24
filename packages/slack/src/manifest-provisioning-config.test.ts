import { describe, expect, it } from 'vitest';

import { parseManifestProvisioningConfig } from './manifest-provisioning-config.js';

describe('parseManifestProvisioningConfig', () => {
  it('returns ok:true with a parsed config for valid env input', () => {
    const result = parseManifestProvisioningConfig({
      MOE_SLACK_APP_CONFIG_TOKEN: 'fake-config-token',
    });

    expect(result).toEqual({
      ok: true,
      config: { configToken: 'fake-config-token' },
    });
  });

  it('returns ok:false when MOE_SLACK_APP_CONFIG_TOKEN is missing', () => {
    const result = parseManifestProvisioningConfig({});

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_SLACK_APP_CONFIG_TOKEN is an empty string', () => {
    const result = parseManifestProvisioningConfig({
      MOE_SLACK_APP_CONFIG_TOKEN: '',
    });

    expect(result.ok).toBe(false);
  });
});
