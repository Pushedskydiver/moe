import { describe, expect, it } from 'vitest';

import { formatEnvFileContents } from './format-env-file-contents.js';

describe('formatEnvFileContents', () => {
  it('joins each entry as KEY=value on its own line, with a trailing newline', () => {
    const result = formatEnvFileContents({
      PGHOST: 'localhost',
      PGPORT: '5432',
    });
    expect(result).toBe('PGHOST=localhost\nPGPORT=5432\n');
  });
});
