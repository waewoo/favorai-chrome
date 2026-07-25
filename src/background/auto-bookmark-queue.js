const QUEUE_STORAGE_KEY = 'autoBookmarkClassificationQueue';

function storageGet(storage, key) {
  return new Promise(resolve => storage.get([key], result => resolve(result?.[key] || [])));
}

function storageSet(storage, key, value) {
  return new Promise(resolve => storage.set({ [key]: value }, resolve));
}

function isTerminal(status) {
  return status === 'done' || status === 'failed' || status === 'uncertain' || status === 'canceled';
}

export function createAutoBookmarkQueue({
  storage = chrome.storage.local,
  getPolicy,
  processItem,
  onUncertain = async () => {},
  now = () => Date.now()
}) {
  let items = [];
  let initialized = false;
  let processing = false;
  let activeItemId = null;
  let activeController = null;
  let timer = null;

  async function load() {
    if (!initialized) {
      const stored = await storageGet(storage, QUEUE_STORAGE_KEY);
      items = Array.isArray(stored) ? stored.filter(item => item && item.id) : [];
      items = items.map(item => item.status === 'processing' ? { ...item, status: 'queued' } : item);
      initialized = true;
    }
    return items;
  }

  async function persist() {
    const policy = await getPolicy();
    const cutoff = now() - policy.retentionMs;
    items = items.filter(item => !isTerminal(item.status) || item.updatedAt >= cutoff);
    await storageSet(storage, QUEUE_STORAGE_KEY, items);
  }

  function schedule(delayMs) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void drain();
    }, Math.max(0, delayMs));
  }

  async function drain() {
    await load();
    if (processing) return;

    const policy = await getPolicy();
    const queued = items.filter(item => item.status === 'queued');
    if (!queued.length) return;

    const first = queued[0];
    const burst = queued.filter(item =>
      item.parentId === first.parentId &&
      Math.abs(item.enqueuedAt - first.enqueuedAt) <= policy.debounceMs
    );

    if (burst.length >= policy.burstThreshold) {
      const burstIds = new Set(burst.map(item => item.id));
      const updatedAt = now();
      items = items.map(item => burstIds.has(item.id)
        ? { ...item, status: 'uncertain', reason: 'burst', updatedAt }
        : item);
      await persist();
      for (const item of burst) await onUncertain(item, 'burst');
      if (items.some(item => item.status === 'queued')) schedule(policy.debounceMs);
      return;
    }

    const item = first;
    items = items.map(candidate => candidate.id === item.id
      ? { ...candidate, status: 'processing', attemptCount: (candidate.attemptCount || 0) + 1, updatedAt: now() }
      : candidate);
    await persist();
    processing = true;
    activeItemId = item.id;
    activeController = new AbortController();
    try {
      await processItem(item, activeController.signal);
      items = items.map(candidate => candidate.id === item.id && candidate.status === 'processing'
        ? { ...candidate, status: 'done', updatedAt: now() }
        : candidate);
    } catch (error) {
      items = items.map(candidate => candidate.id === item.id && candidate.status === 'processing'
        ? { ...candidate, status: 'failed', error: error?.message || String(error), updatedAt: now() }
        : candidate);
    } finally {
      activeItemId = null;
      activeController = null;
      processing = false;
      await persist();
      if (items.some(candidate => candidate.status === 'queued')) schedule(0);
    }
  }

  return {
    async enqueue(item) {
      await load();
      if (!item?.id || items.some(candidate => candidate.id === String(item.id) && !isTerminal(candidate.status))) return false;
      items.push({
        ...item,
        id: String(item.id),
        status: 'queued',
        enqueuedAt: item.enqueuedAt || now(),
        updatedAt: now(),
        attemptCount: 0
      });
      await persist();
      const policy = await getPolicy();
      schedule(policy.debounceMs);
      return true;
    },

    async cancel(id) {
      await load();
      const targetId = String(id || '');
      let changed = false;
      items = items.map(item => {
        if (item.id !== targetId || isTerminal(item.status)) return item;
        changed = true;
        return { ...item, status: 'canceled', updatedAt: now() };
      });
      if (activeItemId === targetId && activeController) activeController.abort();
      if (changed) await persist();
      return changed;
    },

    async recover() {
      await load();
      await persist();
      if (items.some(item => item.status === 'queued')) {
        const policy = await getPolicy();
        schedule(policy.debounceMs);
      }
    },

    async getItems() {
      return [...await load()];
    },

    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await drain();
    }
  };
}

export { QUEUE_STORAGE_KEY };
