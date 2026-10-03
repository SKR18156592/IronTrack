import { getJ, reportStorageFailure, setJ } from './storage.js';

// A list of records kept in IndexedDB, which has no ~5 MB cap like localStorage. An in-memory copy keeps
// reads synchronous, so load() must finish before anything reads or writes the list. If IndexedDB can't
// be opened (some private-browsing modes), the list stays in localStorage under fallbackKey.

const DB_NAME = 'irontrack';
const STORE = 'kv';
let opening = null; // one connection, shared by every list

function openDb() {
  return (opening ||= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  }));
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// record: the IndexedDB key. fallbackKey: the localStorage key used without IndexedDB; a list found
// there once IndexedDB works is moved over with merge(stored, found).
export function createListStore({ record, fallbackKey, merge }) {
  let cache = [];
  let db = null; // null: the list persists to localStorage instead
  let loading = null;
  let writes = Promise.resolve();

  async function load() {
    const legacy = getJ(fallbackKey, null);
    try {
      db = await openDb();
      const stored = await run(db, 'readonly', s => s.get(record));
      cache = Array.isArray(stored) ? stored : [];
      if (Array.isArray(legacy)) {
        // Merged, not replaced, in case an earlier move was cut off.
        cache = merge(cache, legacy);
        await run(db, 'readwrite', s => s.put(cache, record));
        localStorage.removeItem(fallbackKey);
      }
    } catch (e) {
      console.warn(`${record} falls back to localStorage:`, e);
      db = null;
      cache = Array.isArray(legacy) ? legacy : [];
    }
  }

  return {
    // Idempotent: every caller gets the same load.
    load: () => loading || (loading = load()),
    // A copy, so callers can modify it freely.
    get: () => structuredClone(cache),
    // Returns false only when a localStorage fallback write fails. IndexedDB writes finish in the
    // background, in order, and warn the user if one fails.
    set(list) {
      cache = structuredClone(list);
      if (!db) return setJ(fallbackKey, cache);
      const snapshot = cache;
      writes = writes.then(() => run(db, 'readwrite', s => s.put(snapshot, record))).catch(reportStorageFailure);
      return true;
    },
    // Resolves once every pending write has landed.
    flush: () => writes
  };
}
