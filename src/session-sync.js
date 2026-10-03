import { mergeHistories, sessionKey, sessionTime } from './history-merge.js';
import { HISTORY_TOMBSTONES_KEY, getHistory, setHistory } from './history-store.js';
import { fingerprint } from './fingerprint.js';
import { createRowSync } from './row-sync.js';
import { getJ, getL, setJ, setL } from './storage.js';

// Each workout session syncs as its own workout_sessions row (see row-sync.js), so a sync sends only
// the sessions that changed instead of the whole history.

// Bookkeeping, outside the iron_ namespace so it is never synced itself.
export const SESSIONS_CURSOR_KEY = 'irontrack_sessions_cursor'; // newest server updated_at pulled
export const SESSIONS_SYNCED_KEY = 'irontrack_sessions_synced'; // session id -> fingerprint of the cloud's version
export const SESSIONS_MIGRATED_KEY = 'irontrack_sessions_migrated'; // user id whose user_sync.history was moved over

const byNewest = (a, b) => sessionTime(b) - sessionTime(a);

// Sessions without an id (old imports) get one derived from their content, so every device picks the same id.
function withIds(history) {
  let changed = false;
  const out = history.map(rec => {
    if (rec && rec.id) return rec;
    changed = true;
    return { ...rec, id: 'legacy_' + fingerprint(rec) };
  });
  if (changed) setHistory(out);
  return out;
}

const rows = createRowSync({
  table: 'workout_sessions',
  cursorKey: SESSIONS_CURSOR_KEY,
  syncedKey: SESSIONS_SYNCED_KEY,
  tombstonesKey: HISTORY_TOMBSTONES_KEY,
  getItems: getHistory,
  setItems: setHistory,
  keyOf: sessionKey,
  sortItems: list => list.sort(byNewest),
  pushItems: () => withIds(getHistory())
});

// Applies cloud rows to local history. Returns whether local history changed.
export const applySessionRows = rows.applyRows;

// One-time per device and account: merge in the history that older versions kept in user_sync.history.
// Runs after a full pull, so sessions deleted since then on an updated device are already tombstoned.
async function mergeLegacyHistory(client, userId) {
  const { data: row, error } = await client
    .from('user_sync')
    .select('history, local_storage_backup')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return false;
  const cloudHistory = Array.isArray(row.history) ? row.history : [];
  let cloudTombstones = row.local_storage_backup && row.local_storage_backup[HISTORY_TOMBSTONES_KEY];
  try {
    cloudTombstones = typeof cloudTombstones === 'string' ? JSON.parse(cloudTombstones) : cloudTombstones;
  } catch (e) {
    cloudTombstones = [];
  }
  const { merged, tombstones, localChanged } = mergeHistories({
    localHistory: getHistory(),
    cloudHistory,
    localTombstones: getJ(HISTORY_TOMBSTONES_KEY, []),
    cloudTombstones: Array.isArray(cloudTombstones) ? cloudTombstones : []
  });
  setJ(HISTORY_TOMBSTONES_KEY, tombstones);
  if (localChanged) setHistory(merged);
  return localChanged;
}

// Pull, then push. Resolves { changed, uploaded }: whether local history changed and how many rows went
// up. Rejects if the cloud can't be reached.
export function syncSessions(client, userId) {
  let migrating = false;
  return rows.sync(client, userId, {
    between: async () => {
      migrating = getL(SESSIONS_MIGRATED_KEY, '') !== userId;
      return migrating && mergeLegacyHistory(client, userId);
    },
    after: () => {
      if (migrating) setL(SESSIONS_MIGRATED_KEY, userId);
    }
  });
}
