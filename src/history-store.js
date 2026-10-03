import { mergeHistories } from './history-merge.js';
import { getJ, reportStorageFailure, setJ } from './storage.js';

// Workout history lives in IndexedDB, which has no ~5 MB cap like localStorage. An in-memory copy
// keeps reads synchronous, so loadHistory() must finish before anything reads or writes history.
// If IndexedDB can't be opened (some private-browsing modes), history stays in localStorage.

export const HISTORY_KEY = 'iron_workout_history'; // its localStorage key before IndexedDB, and its name in backups
export const HISTORY_TOMBSTONES_KEY = 'iron_history_tombstones'; // ids of deleted sessions
const DB_NAME = 'irontrack';
const STORE = 'kv';
const RECORD = 'workout_history';

let cache = [];
let db = null; // null: history persists to localStorage instead
let loading = null;
let writes = Promise.resolve();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function run(mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

async function load() {
  const legacy = getJ(HISTORY_KEY, null);
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
    db = await openDb();
    const stored = await run('readonly', s => s.get(RECORD));
    cache = Array.isArray(stored) ? stored : [];
    if (Array.isArray(legacy)) {
      // One-time move out of localStorage. Merged, not replaced, in case an earlier move was cut off.
      cache = mergeHistories({ localHistory: cache, cloudHistory: legacy, localTombstones: getJ(HISTORY_TOMBSTONES_KEY, []) }).merged;
      await run('readwrite', s => s.put(cache, RECORD));
      localStorage.removeItem(HISTORY_KEY);
    }
  } catch (e) {
    console.warn('Workout history falls back to localStorage:', e);
    db = null;
    cache = Array.isArray(legacy) ? legacy : [];
  }
}

// Idempotent: every caller gets the same load.
export function loadHistory() {
  return loading || (loading = load());
}

// Returns a copy, so callers can modify it freely.
export function getHistory() {
  return structuredClone(cache);
}

// Returns false only when a localStorage fallback write fails. IndexedDB writes finish in the
// background, in order, and warn the user if one fails.
export function setHistory(list) {
  cache = structuredClone(list);
  if (!db) return setJ(HISTORY_KEY, cache);
  const snapshot = cache;
  writes = writes.then(() => run('readwrite', s => s.put(snapshot, RECORD))).catch(reportStorageFailure);
  return true;
}

export function clearHistory() {
  return setHistory([]);
}

// Resolves once every pending write has landed.
export function flushHistory() {
  return writes;
}

// Asks the browser not to evict our storage when the device runs low on space. Some browsers ask
// the user, so this is called after a workout is saved rather than on startup.
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
