import { describe, expect, it } from 'vitest';

import { parseGithubConfig } from './github-config.js';

describe('parseGithubConfig', () => {
  it('returns ok:true with a parsed config for valid env input', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY:
        '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: 'Pushedskydiver/chief-clancy',
    });

    expect(result).toEqual({
      ok: true,
      config: {
        appId: '123456',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
        installationId: 789,
        repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
      },
    });
  });

  it('returns ok:false when MOE_GITHUB_APP_ID is missing', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: 'Pushedskydiver/chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_PRIVATE_KEY is missing', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: 'Pushedskydiver/chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_PRIVATE_KEY is blank', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: '',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: 'Pushedskydiver/chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_INSTALLATION_ID is missing', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_REPO: 'Pushedskydiver/chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_INSTALLATION_ID is not a positive integer', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_INSTALLATION_ID: 'not-a-number',
      MOE_GITHUB_REPO: 'Pushedskydiver/chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_REPO is missing', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_INSTALLATION_ID: '789',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_REPO has no slash', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: 'chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_REPO has more than one slash', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: 'Pushedskydiver/chief-clancy/extra',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_REPO has an empty owner or name', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: '/chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when MOE_GITHUB_REPO has embedded whitespace', () => {
    const result = parseGithubConfig({
      MOE_GITHUB_APP_ID: '123456',
      MOE_GITHUB_PRIVATE_KEY: 'fake-key',
      MOE_GITHUB_INSTALLATION_ID: '789',
      MOE_GITHUB_REPO: ' Pushedskydiver /chief-clancy',
    });

    expect(result.ok).toBe(false);
  });

  it('returns a typed, non-empty list of issues in the ok:false error channel', () => {
    const result = parseGithubConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-config');
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
