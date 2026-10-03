import { mergeHistories, sessionKey, sessionTime } from './history-merge.js';
import { HISTORY_TOMBSTONES_KEY, getHistory, setHistory } from './history-store.js';
import { getJ, getL, setJ, setL } from './storage.js';

// Each workout session syncs as its own workout_sessions row, so a sync sends only the sessions
// that changed instead of the whole history. Deleted sessions stay as rows with deleted = true.

const TABLE = 'workout_sessions';
// Bookkeeping, outside the iron_ namespace so it is never synced itself.
export const SESSIONS_CURSOR_KEY = 'irontrack_sessions_cursor'; // newest server updated_at pulled
export const SESSIONS_SYNCED_KEY = 'irontrack_sessions_synced'; // session id -> fingerprint of the cloud's version
export const SESSIONS_MIGRATED_KEY = 'irontrack_sessions_migrated'; // user id whose user_sync.history was moved over
const DELETED = 'deleted';
// A write can commit with an earlier updated_at than one already pulled, so each pull re-reads a
// minute back. Applying a row twice is harmless.
const CURSOR_OVERLAP_MS = 60000;
const PAGE_SIZE = 500;
const UPLOAD_CHUNK = 100;

// Key order is normalized because Postgres jsonb does not keep it.
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return (
      '{' +
      Object.keys(v)
        .sort()
        .filter(k => v[k] !== undefined)
        .map(k => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v ?? null);
}

// FNV-1a hash plus length: identifies a version of a session, not a security measure.
export function fingerprint(rec) {
  const s = canonical(rec);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + '.' + s.length.toString(36);
}

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

// Applies cloud rows to local history. A local version the cloud doesn't have yet wins over the cloud's
// (it uploads next), except that a deletion always wins. Returns whether local history changed.
export function applySessionRows(rows) {
  if (!rows.length) return false;
  const synced = getJ(SESSIONS_SYNCED_KEY, {});
  const tombstones = new Set(getJ(HISTORY_TOMBSTONES_KEY, []));
  const local = new Map(getHistory().map(rec => [sessionKey(rec), rec]));
  let changed = false;

  for (const row of rows) {
    const mine = local.get(row.id);
    if (row.deleted) {
      tombstones.add(row.id);
      synced[row.id] = DELETED;
      if (mine) {
        local.delete(row.id);
        changed = true;
      }
      continue;
    }
    if (tombstones.has(row.id)) continue; // deleted here; the deletion uploads next
    const theirs = fingerprint(row.data);
    if (mine && fingerprint(mine) === theirs) {
      synced[row.id] = theirs;
      continue;
    }
    if (mine && fingerprint(mine) !== synced[row.id]) continue; // edited here and not uploaded yet
    local.set(row.id, row.data);
    synced[row.id] = theirs;
    changed = true;
  }

  setJ(SESSIONS_SYNCED_KEY, synced);
  setJ(HISTORY_TOMBSTONES_KEY, [...tombstones]);
  if (changed) setHistory([...local.values()].sort(byNewest));
  return changed;
}

async function pullSessions(client, userId) {
  const cursor = getL(SESSIONS_CURSOR_KEY, '');
  const since = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(TABLE).select('id, data, deleted, updated_at').eq('user_id', userId);
    if (since) query = query.gt('updated_at', since);
    const { data, error } = await query
      .order('updated_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  const changed = applySessionRows(rows);
  const newest = rows.reduce(
    (max, r) => (!max || Date.parse(r.updated_at) > Date.parse(max) ? r.updated_at : max),
    cursor
  );
  if (newest) setL(SESSIONS_CURSOR_KEY, newest);
  return changed;
}

async function pushSessions(client, userId) {
  const synced = getJ(SESSIONS_SYNCED_KEY, {});
  const pending = [];
  for (const rec of withIds(getHistory())) {
    const fp = fingerprint(rec);
    if (synced[rec.id] !== fp) pending.push({ row: { user_id: userId, id: rec.id, data: rec, deleted: false }, fp });
  }
  for (const id of getJ(HISTORY_TOMBSTONES_KEY, [])) {
    if (synced[id] !== DELETED) pending.push({ row: { user_id: userId, id, data: null, deleted: true }, fp: DELETED });
  }

  for (let i = 0; i < pending.length; i += UPLOAD_CHUNK) {
    const chunk = pending.slice(i, i + UPLOAD_CHUNK);
    const { error } = await client.from(TABLE).upsert(
      chunk.map(p => p.row),
      { onConflict: 'user_id,id' }
    );
    if (error) throw error;
    // Saved per chunk, so an interrupted upload resumes where it stopped.
    const latest = getJ(SESSIONS_SYNCED_KEY, {});
    chunk.forEach(p => {
      latest[p.row.id] = p.fp;
    });
    setJ(SESSIONS_SYNCED_KEY, latest);
  }
  return pending.length;
}

// Once the cloud has a session's deletion, its deleted row is what keeps it from coming back
// (pulled again, it re-adds the tombstone), so the local tombstone and bookkeeping can go.
function pruneTombstones() {
  const synced = getJ(SESSIONS_SYNCED_KEY, {});
  const tombstones = getJ(HISTORY_TOMBSTONES_KEY, []);
  const kept = tombstones.filter(id => synced[id] !== DELETED);
  if (kept.length === tombstones.length) return;
  tombstones.forEach(id => {
    if (synced[id] === DELETED) delete synced[id];
  });
  setJ(HISTORY_TOMBSTONES_KEY, kept);
  setJ(SESSIONS_SYNCED_KEY, synced);
}

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

// Pull, then push. Runs one at a time, each after the previous one, so none misses an earlier edit.
// Resolves { changed, uploaded }: whether local history changed and how many rows went up.
// Rejects if the cloud can't be reached.
let queue = Promise.resolve();
export function syncSessions(client, userId) {
  const run = async () => {
    let changed = await pullSessions(client, userId);
    const migrating = getL(SESSIONS_MIGRATED_KEY, '') !== userId;
    if (migrating && (await mergeLegacyHistory(client, userId))) changed = true;
    const uploaded = await pushSessions(client, userId);
    if (migrating) setL(SESSIONS_MIGRATED_KEY, userId);
    pruneTombstones();
    return { changed, uploaded };
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
