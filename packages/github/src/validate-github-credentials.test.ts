import { describe, expect, it, vi } from 'vitest';

import { validateGithubCredentials } from './validate-github-credentials.js';

const mocks = vi.hoisted(() => ({
  createAppAuth: vi.fn(),
}));

vi.mock('@octokit/auth-app', () => ({ createAppAuth: mocks.createAppAuth }));

describe('validateGithubCredentials', () => {
  it('returns ok:true when the installation-token exchange succeeds', async () => {
    const auth = vi
      .fn()
      .mockResolvedValue({ token: 'fake-installation-token' });
    mocks.createAppAuth.mockReturnValue(auth);

    const result = await validateGithubCredentials({
      appId: '123456',
      privateKey: 'fake-key',
      installationId: 789,
      repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
    });

    expect(mocks.createAppAuth).toHaveBeenCalledWith({
      appId: '123456',
      privateKey: 'fake-key',
      installationId: 789,
    });
    expect(auth).toHaveBeenCalledWith({ type: 'installation' });
    expect(result).toEqual({ ok: true });
  });

  it('returns ok:false with the error message when the exchange throws (bad key, revoked installation, etc.)', async () => {
    const auth = vi
      .fn()
      .mockRejectedValue(
        new Error('secretOrPrivateKey must be an asymmetric key'),
      );
    mocks.createAppAuth.mockReturnValue(auth);

    const result = await validateGithubCredentials({
      appId: '123456',
      privateKey: 'truncated-key',
      installationId: 789,
      repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-credentials',
        message: 'secretOrPrivateKey must be an asymmetric key',
      },
    });
  });
});
