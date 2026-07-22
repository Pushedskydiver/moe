export function getPackageName(): string {
  return '@moe/github';
}

export type { GithubConfig, ParseGithubConfigResult } from './github-config.js';
export { parseGithubConfig } from './github-config.js';
export { createGithubClient } from './create-github-client.js';
export type { ValidateGithubCredentialsResult } from './validate-github-credentials.js';
export { validateGithubCredentials } from './validate-github-credentials.js';
export type { ListOpenIssuesResult, OpenIssue } from './list-open-issues.js';
export { listOpenIssues } from './list-open-issues.js';
export type { ComposeExternalPostBodyParams } from './compose-external-post-body.js';
export { composeExternalPostBody } from './compose-external-post-body.js';
