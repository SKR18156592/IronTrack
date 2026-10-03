import { mergeHistories } from './history-merge.js';
import { createListStore } from './list-store.js';
import { getJ } from './storage.js';

// Workout history, in IndexedDB (see list-store.js). loadHistory() must finish before anything reads
// or writes it.

export const HISTORY_KEY = 'iron_workout_history'; // its localStorage key before IndexedDB, and its name in backups
export const HISTORY_TOMBSTONES_KEY = 'iron_history_tombstones'; // ids of deleted sessions

const store = createListStore({
  record: 'workout_history',
  fallbackKey: HISTORY_KEY,
  merge: (stored, legacy) =>
    mergeHistories({
      localHistory: stored,
      cloudHistory: legacy,
      localTombstones: getJ(HISTORY_TOMBSTONES_KEY, [])
    }).merged
});

export const loadHistory = store.load;
export const getHistory = store.get;
export const setHistory = store.set;
export const clearHistory = () => store.set([]);
export const flushHistory = store.flush;

// Asks the browser not to evict our storage when the device runs low on space. Some browsers ask
// the user, so this is called after a workout is saved rather than on startup.
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
