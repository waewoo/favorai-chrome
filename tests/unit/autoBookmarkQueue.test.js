import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoBookmarkQueue } from '../../src/background/auto-bookmark-queue.js';

function createStorage() {
  let value = [];
  return {
    get: vi.fn((keys, callback) => callback({ autoBookmarkClassificationQueue: value })),
    set: vi.fn((data, callback) => { value = data.autoBookmarkClassificationQueue; callback?.(); }),
    read: () => value
  };
}

function createEmptyStorage() {
  let value;
  return {
    get: vi.fn((keys, callback) => callback({})),
    set: vi.fn((data, callback) => { value = data.autoBookmarkClassificationQueue; callback?.(); }),
    read: () => value
  };
}

function createInvalidStorage() {
  return {
    get: vi.fn((keys, callback) => callback({ autoBookmarkClassificationQueue: {} })),
    set: vi.fn((data, callback) => callback?.())
  };
}

describe('auto bookmark queue', () => {
  beforeEach(() => vi.useFakeTimers());

  it('uses an empty queue when storage has no queue value', async () => {
    const queue = createAutoBookmarkQueue({
      storage: createEmptyStorage(),
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: vi.fn()
    });

    expect(await queue.getItems()).toEqual([]);
  });

  it('uses an empty queue when persisted queue data is not an array', async () => {
    const queue = createAutoBookmarkQueue({
      storage: createInvalidStorage(),
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: vi.fn()
    });

    expect(await queue.getItems()).toEqual([]);
  });

  it('processes one item at a time and deduplicates queued IDs', async () => {
    const storage = createStorage();
    const processed = [];
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: async item => { processed.push(item.id); }
    });

    await queue.enqueue({ id: 'one', parentId: '1' });
    await queue.enqueue({ id: 'one', parentId: '1' });
    vi.advanceTimersByTime(10);
    await vi.waitFor(() => expect(processed).toEqual(['one']));
    expect(storage.read()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'one', status: 'done' })]));
  });

  it('marks a same-parent burst uncertain without processing it', async () => {
    const storage = createStorage();
    const processed = vi.fn();
    const uncertain = vi.fn();
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: processed,
      onUncertain: uncertain
    });

    await queue.enqueue({ id: 'one', parentId: '1', enqueuedAt: 100 });
    await queue.enqueue({ id: 'two', parentId: '1', enqueuedAt: 105 });
    await queue.enqueue({ id: 'three', parentId: '1', enqueuedAt: 108 });
    await queue.flush();

    expect(processed).not.toHaveBeenCalled();
    expect(uncertain).toHaveBeenCalledTimes(3);
    expect(storage.read().every(item => item.status === 'uncertain')).toBe(true);
  });

  it('uses the default uncertain handler when a burst is detected', async () => {
    const storage = createStorage();
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 2, retentionMs: 1000 }),
      processItem: vi.fn()
    });

    await queue.enqueue({ id: 'one', parentId: '1', enqueuedAt: 100 });
    await queue.enqueue({ id: 'two', parentId: '1', enqueuedAt: 105 });
    await queue.flush();

    expect(storage.read().every(item => item.status === 'uncertain')).toBe(true);
  });

  it('reschedules queued items that fall outside an uncertain burst', async () => {
    const storage = createStorage();
    const processed = [];
    const uncertain = vi.fn();
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: async item => { processed.push(item.id); },
      onUncertain: uncertain
    });

    await queue.enqueue({ id: 'one', parentId: '1', enqueuedAt: 100 });
    await queue.enqueue({ id: 'two', parentId: '1', enqueuedAt: 105 });
    await queue.enqueue({ id: 'three', parentId: '1', enqueuedAt: 108 });
    await queue.enqueue({ id: 'other-parent', parentId: '2', enqueuedAt: 109 });
    await queue.flush();
    await queue.flush();

    expect(uncertain).toHaveBeenCalledTimes(3);
    expect(processed).toEqual(['other-parent']);
  });

  it('recovers processing items as queued and supports cancellation', async () => {
    const storage = createStorage();
    storage.set({ autoBookmarkClassificationQueue: [{ id: 'old', status: 'processing', parentId: '1' }] });
    const processed = vi.fn();
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: processed
    });

    await queue.recover();
    await queue.cancel('old');
    await queue.flush();

    expect(processed).not.toHaveBeenCalled();
    expect(storage.read()[0]).toEqual(expect.objectContaining({ id: 'old', status: 'canceled' }));
  });

  it('does not mark a canceled in-flight item done after a late result', async () => {
    const storage = createStorage();
    let release;
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 0, burstThreshold: 3, retentionMs: 1000 }),
      processItem: async () => new Promise(resolve => { release = resolve; })
    });

    await queue.enqueue({ id: 'late', parentId: '1' });
    vi.advanceTimersByTime(0);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await queue.cancel('late');
    release();
    await Promise.resolve();

    expect(storage.read()[0]).toEqual(expect.objectContaining({ id: 'late', status: 'canceled' }));
  });

  it('does not start a second drain while the first item is processing', async () => {
    const storage = createStorage();
    let release;
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 0, burstThreshold: 3, retentionMs: 1000 }),
      processItem: async () => new Promise(resolve => { release = resolve; })
    });

    await queue.enqueue({ id: 'active', parentId: '1' });
    vi.advanceTimersByTime(0);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await queue.flush();
    release();
    await vi.waitFor(() => expect(storage.read()[0].status).toBe('done'));
  });

  it('marks an item failed when processing throws and exposes queued items', async () => {
    const storage = createStorage();
    storage.set({ autoBookmarkClassificationQueue: [
      { id: 'failed', status: 'processing', parentId: '1' },
      { id: 'waiting', status: 'queued', parentId: '1' }
    ] });
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 0, burstThreshold: 3, retentionMs: 1000 }),
      processItem: async () => { throw new Error('Provider failed'); }
    });

    expect(await queue.getItems()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'failed', status: 'queued' })
    ]));
    await queue.recover();
    await queue.flush();

    expect(storage.read()[0]).toEqual(expect.objectContaining({
      id: 'failed',
      status: 'failed',
      error: 'Provider failed'
    }));

    const fallbackStorage = createStorage();
    const fallbackQueue = createAutoBookmarkQueue({
      storage: fallbackStorage,
      getPolicy: async () => ({ debounceMs: 0, burstThreshold: 3, retentionMs: 1000 }),
      processItem: async () => { throw {}; }
    });
    await fallbackQueue.enqueue({ id: 'failed-fallback', parentId: '1' });
    await fallbackQueue.flush();
    expect(fallbackStorage.read()[0]).toEqual(expect.objectContaining({
      id: 'failed-fallback',
      status: 'failed',
      error: '[object Object]'
    }));
  });

  it('does not cancel terminal items and persists cancellation for queued items', async () => {
    const storage = createStorage();
    storage.set({ autoBookmarkClassificationQueue: [
      { id: 'done', status: 'done', parentId: '1' },
      { id: 'queued', status: 'queued', parentId: '1' }
    ] });
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: vi.fn()
    });

    expect(await queue.cancel('done')).toBe(false);
    expect(await queue.cancel('queued')).toBe(true);
    expect(storage.read()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'queued', status: 'canceled' })
    ]));
  });

  it('recovers processing work and drains the next queued item', async () => {
    const storage = createStorage();
    storage.set({ autoBookmarkClassificationQueue: [
      { id: 'processing', status: 'processing', parentId: '1' },
      { id: 'next', status: 'queued', parentId: '1' }
    ] });
    const processed = [];
    const queue = createAutoBookmarkQueue({
      storage,
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: async item => { processed.push(item.id); }
    });

    const emptyQueue = createAutoBookmarkQueue({
      storage: createStorage(),
      getPolicy: async () => ({ debounceMs: 10, burstThreshold: 3, retentionMs: 1000 }),
      processItem: vi.fn()
    });
    await emptyQueue.flush();
    expect(await queue.cancel()).toBe(false);
    await queue.recover();
    await queue.flush();
    await queue.flush();
    await queue.recover();

    expect(processed).toEqual(['processing', 'next']);
  });
});
