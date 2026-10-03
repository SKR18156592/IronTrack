import { createListStore } from './list-store.js';
import { createRowSync } from './row-sync.js';
import { getJ, setJ } from './storage.js';

// The daily nutrition log: what was eaten, water drunk and body weight, one entry each, in IndexedDB
// (see list-store.js) and synced as one nutrition_log row per entry (see row-sync.js). Entries:
//   { id, date: 'YYYY-MM-DD', at: ms, type: 'food', name, amount, unit, kcal, p, c, f, food?, meal? }
//   { id, date, at, type: 'water', ml }
//   { id, date, at, type: 'weight', kg }
// A food entry keeps its own nutrients, so editing or removing a food later doesn't change the past.

// Device-local: never uploaded through the settings row (the entries sync through their own table).
export const NUTRITION_LOG_KEY = 'iron_nutrition_log'; // localStorage fallback without IndexedDB, and its name in backups
export const NUTRITION_TOMBSTONES_KEY = 'iron_nutrition_tombstones'; // ids of deleted entries
// Bookkeeping, outside the iron_ namespace so it is never synced itself.
export const NUTRITION_CURSOR_KEY = 'irontrack_nutrition_cursor';
export const NUTRITION_SYNCED_KEY = 'irontrack_nutrition_synced';

const byTime = (a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1);

const store = createListStore({
  record: 'nutrition_log',
  fallbackKey: NUTRITION_LOG_KEY,
  merge: (stored, legacy) => {
    const ids = new Set(stored.map(e => e.id));
    return [...stored, ...legacy.filter(e => !ids.has(e.id))].sort(byTime);
  }
});

export const loadNutritionLog = store.load;
export const getNutritionLog = store.get;
export const setNutritionLog = list => store.set([...list].sort(byTime));
export const clearNutritionLog = () => store.set([]);
export const flushNutritionLog = store.flush;

// 'YYYY-MM-DD' in local time.
export function localDate(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

const newId = () => 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Adds entries ({ type, date, ... } without id or at) and returns them with theirs.
export function addEntries(list) {
  const at = Date.now();
  const added = list.map((e, i) => ({ ...e, id: newId(), at: at + i }));
  setNutritionLog([...getNutritionLog(), ...added]);
  return added;
}

export function removeEntry(id) {
  const log = getNutritionLog();
  if (!log.some(e => e.id === id)) return false;
  setNutritionLog(log.filter(e => e.id !== id));
  setJ(NUTRITION_TOMBSTONES_KEY, [...new Set([...getJ(NUTRITION_TOMBSTONES_KEY, []), id])]);
  return true;
}

export const entriesOn = (log, date) => log.filter(e => e.date === date);

// Totals for one day. weight: the last weight logged that day, or null.
export function dayTotals(log, date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, water: 0, weight: null };
  for (const e of entriesOn(log, date)) {
    if (e.type === 'food') {
      t.kcal += e.kcal;
      t.p += e.p;
      t.c += e.c;
      t.f += e.f;
    } else if (e.type === 'water') t.water += e.ml;
    else if (e.type === 'weight') t.weight = e.kg;
  }
  return t;
}

// One weight per day (the day's last), oldest first: [{ date, kg }].
export function weightSeries(log) {
  const byDay = new Map();
  for (const e of log) if (e.type === 'weight') byDay.set(e.date, e.kg);
  return [...byDay].map(([date, kg]) => ({ date, kg })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

const rows = createRowSync({
  table: 'nutrition_log',
  cursorKey: NUTRITION_CURSOR_KEY,
  syncedKey: NUTRITION_SYNCED_KEY,
  tombstonesKey: NUTRITION_TOMBSTONES_KEY,
  getItems: getNutritionLog,
  setItems: setNutritionLog,
  // Until supabase/user_sync.sql is re-run, the log stays on this device and the rest still syncs.
  optional: true
});

export const syncNutritionLog = (client, userId) => rows.sync(client, userId);
