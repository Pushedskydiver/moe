import { describe, expect, it } from 'vitest';

import { makeThreadQueue } from './thread-queue.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('makeThreadQueue', () => {
  it('runs a single call and resolves with its return value', async () => {
    const queue = makeThreadQueue();

    const result = await queue.run('T1', async () => 'done');

    expect(result).toBe('done');
  });

  it('runs calls for the same key strictly in order, second waits for the first', async () => {
    const queue = makeThreadQueue();
    const order: string[] = [];
    const first = deferred<void>();

    const firstCall = queue.run('T1', async () => {
      order.push('first-start');
      await first.promise;
      order.push('first-end');
    });
    const secondCall = queue.run('T1', async () => {
      order.push('second-start');
    });

    // Give the microtask queue a tick — if the queue were not serializing, `second-start`
    // would already be in `order` here, before `first` has even been allowed to resolve.
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['first-start']);

    first.resolve();
    await firstCall;
    await secondCall;

    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('lets calls for different keys run concurrently', async () => {
    const queue = makeThreadQueue();
    const order: string[] = [];
    const first = deferred<void>();

    const firstCall = queue.run('T1', async () => {
      order.push('t1-start');
      await first.promise;
      order.push('t1-end');
    });
    const secondCall = queue.run('T2', async () => {
      order.push('t2-start');
      order.push('t2-end');
    });

    await secondCall;
    expect(order).toEqual(['t1-start', 't2-start', 't2-end']);

    first.resolve();
    await firstCall;
    expect(order).toEqual(['t1-start', 't2-start', 't2-end', 't1-end']);
  });

  it('still runs the next call for a key after a prior call threw', async () => {
    const queue = makeThreadQueue();
    const order: string[] = [];

    const firstCall = queue.run('T1', async () => {
      order.push('first');
      throw new Error('boom');
    });
    const secondCall = queue.run('T1', async () => {
      order.push('second');
    });

    await expect(firstCall).rejects.toThrow('boom');
    await secondCall;

    expect(order).toEqual(['first', 'second']);
  });
});
