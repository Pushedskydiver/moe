import { describe, expect, it } from 'vitest';

import { buildCachedSystemBlocks } from './build-cached-system-blocks.js';

describe('buildCachedSystemBlocks', () => {
  it('returns a single text block with a cache_control marker for one segment', () => {
    const blocks = buildCachedSystemBlocks(['hello']);

    expect(blocks).toEqual([
      { type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('marks only the last block cache_control when given two segments, in order', () => {
    const blocks = buildCachedSystemBlocks([
      'persona voice',
      'task instructions',
    ]);

    expect(blocks).toEqual([
      { type: 'text', text: 'persona voice' },
      {
        type: 'text',
        text: 'task instructions',
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('drops undefined segments before indexing which one is last', () => {
    const blocks = buildCachedSystemBlocks(['persona voice', undefined]);

    expect(blocks).toEqual([
      {
        type: 'text',
        text: 'persona voice',
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('drops empty-string segments the same as undefined ones', () => {
    const blocks = buildCachedSystemBlocks(['', 'task instructions']);

    expect(blocks).toEqual([
      {
        type: 'text',
        text: 'task instructions',
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('returns an empty array when every segment is undefined or empty', () => {
    const blocks = buildCachedSystemBlocks([undefined, '']);

    expect(blocks).toEqual([]);
  });
});
