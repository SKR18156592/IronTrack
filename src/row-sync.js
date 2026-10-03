import { fingerprint } from './fingerprint.js';
import { getJ, getL, setJ, setL } from './storage.js';

// Syncs a local list of records with a Supabase table holding one row per record:
// (user_id, id, data jsonb, deleted boolean, updated_at timestamptz set by the server). A sync sends
// only the records that changed. Deleted records stay as rows with deleted = true, so the deletion
// reaches other devices.

const DELETED = 'deleted';
// A write can commit with an earlier updated_at than one already pulled, so each pull re-reads a
// minute back. Applying a row twice is harmless.
const CURSOR_OVERLAP_MS = 60000;
const PAGE_SIZE = 500;
const UPLOAD_CHUNK = 100;

// The table hasn't been created (supabase/user_sync.sql not re-run yet).
const isMissingTable = error =>
  !!error &&
  (error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|could not find the table/i.test(error.message || ''));

// table: the Supabase table. cursorKey, syncedKey: localStorage bookkeeping (newest updated_at pulled;
// record id -> fingerprint of the cloud's version). tombstonesKey: ids deleted on this device.
// getItems / setItems: the local list. keyOf: a record's id. sortItems: orders the list after a pull.
// pushItems: the list as uploaded (default getItems). optional: a missing table skips the sync
// instead of failing it.
export function createRowSync({
  table,
  cursorKey,
  syncedKey,
  tombstonesKey,
  getItems,
  setItems,
  keyOf = rec => rec.id,
  sortItems = list => list,
  pushItems = getItems,
  optional = false
}) {
  // Applies cloud rows to the local list. A local version the cloud doesn't have yet wins over the
  // cloud's (it uploads next), except that a deletion always wins. Returns whether the list changed.
  function applyRows(rows) {
    if (!rows.length) return false;
    const synced = getJ(syncedKey, {});
    const tombstones = new Set(getJ(tombstonesKey, []));
    const local = new Map(getItems().map(rec => [keyOf(rec), rec]));
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

    setJ(syncedKey, synced);
    setJ(tombstonesKey, [...tombstones]);
    if (changed) setItems(sortItems([...local.values()]));
    return changed;
  }

  async function pull(client, userId) {
    const cursor = getL(cursorKey, '');
    const since = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = client.from(table).select('id, data, deleted, updated_at').eq('user_id', userId);
      if (since) query = query.gt('updated_at', since);
      const { data, error } = await query
        .order('updated_at')
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    const changed = applyRows(rows);
    const newest = rows.reduce(
      (max, r) => (!max || Date.parse(r.updated_at) > Date.parse(max) ? r.updated_at : max),
      cursor
    );
    if (newest) setL(cursorKey, newest);
    return changed;
  }

  async function push(client, userId) {
    const synced = getJ(syncedKey, {});
    const pending = [];
    for (const rec of pushItems()) {
      const fp = fingerprint(rec);
      if (synced[keyOf(rec)] !== fp) {
        pending.push({ row: { user_id: userId, id: keyOf(rec), data: rec, deleted: false }, fp });
      }
    }
    for (const id of getJ(tombstonesKey, [])) {
      if (synced[id] !== DELETED)
        pending.push({ row: { user_id: userId, id, data: null, deleted: true }, fp: DELETED });
    }

    for (let i = 0; i < pending.length; i += UPLOAD_CHUNK) {
      const chunk = pending.slice(i, i + UPLOAD_CHUNK);
      const { error } = await client.from(table).upsert(
        chunk.map(p => p.row),
        { onConflict: 'user_id,id' }
      );
      if (error) throw error;
      // Saved per chunk, so an interrupted upload resumes where it stopped.
      const latest = getJ(syncedKey, {});
      chunk.forEach(p => {
        latest[p.row.id] = p.fp;
      });
      setJ(syncedKey, latest);
    }
    return pending.length;
  }

  // Once the cloud has a deletion, its deleted row is what keeps the record from coming back
  // (pulled again, it re-adds the tombstone), so the local tombstone and bookkeeping can go.
  function pruneTombstones() {
    const synced = getJ(syncedKey, {});
    const tombstones = getJ(tombstonesKey, []);
    const kept = tombstones.filter(id => synced[id] !== DELETED);
    if (kept.length === tombstones.length) return;
    tombstones.forEach(id => {
      if (synced[id] === DELETED) delete synced[id];
    });
    setJ(tombstonesKey, kept);
    setJ(syncedKey, synced);
  }

  // Runs syncs one at a time, each after the previous one, so none misses an earlier edit.
  let queue = Promise.resolve();
  function enqueue(fn) {
    const result = queue.then(fn, fn);
    queue = result.catch(() => {});
    return result;
  }

  // Pull, then push. Resolves { changed, uploaded }: whether the local list changed and how many rows
  // went up (plus unavailable: true when an optional table is missing). Rejects if the cloud can't be
  // reached. Hooks, run inside the queue: between() after the pull (resolves whether it changed the
  // local list), after() once the push succeeded.
  function sync(client, userId, { between = async () => false, after = () => {} } = {}) {
    return enqueue(async () => {
      try {
        let changed = await pull(client, userId);
        if (await between()) changed = true;
        const uploaded = await push(client, userId);
        after();
        pruneTombstones();
        return { changed, uploaded };
      } catch (error) {
        if (optional && isMissingTable(error)) {
          console.warn(`${table} is missing: run supabase/user_sync.sql. It stays on this device until then.`);
          return { changed: false, uploaded: 0, unavailable: true };
        }
        throw error;
      }
    });
  }

  return { applyRows, sync };
}
