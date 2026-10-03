import { HISTORY_KEY, HISTORY_TOMBSTONES_KEY } from './history-store.js';
import { NUTRITION_LOG_KEY, NUTRITION_TOMBSTONES_KEY } from './nutrition-log.js';
import { getMicrocycle } from './model.js';
import { fingerprint } from './fingerprint.js';
import { getJ, getL, setJ, setL } from './storage.js';

// Settings sync through one user_sync row. Each synced setting is compared with its value in the cloud
// as of this device's last sync (kept as a fingerprint), so a sync takes another device's changes without
// dropping this device's unsynced ones. Workout history is not in the row: see session-sync.js.

// Bookkeeping, outside the iron_ namespace so it is never synced itself.
export const SYNCED_FPS_KEY = 'irontrack_synced_fps';
// iron_* key -> fingerprint of its value in the cloud as of our last sync
export const LEGACY_SYNCED_KEYS_KEY = 'irontrack_synced_keys';
// older versions: iron_* keys in the last snapshot synced

// localStorage keys that sync through their own user_sync column, so they are left out of
// local_storage_backup (no point uploading them twice).
const COLUMN_KEYS = {
  microcycle_config: 'iron_microcycle_config',
  custom_days: 'iron_custom_days',
  custom_sections: 'iron_custom_sections',
  hidden_days: 'iron_hidden_days',
  history: HISTORY_KEY,
  custom_exercises: 'iron_custom_exercises',
  hidden_exercises: 'iron_hidden_exercises',
  custom_variations: 'iron_custom_variations',
  hidden_variations: 'iron_hidden_variations',
  var_order: 'iron_var_order',
  exercise_orders: 'iron_all_exercise_orders',
  section_orders: 'iron_section_orders',
  profile_name: 'iron_profile_name',
  profile_age: 'iron_profile_age',
  profile_weight: 'iron_profile_weight',
  profile_height: 'iron_profile_height',
  profile_sex: 'iron_profile_sex',
  profile_avatar: 'iron_profile_avatar'
};

// Everything in the row except the history column older versions synced through.
export const ROW_COLUMNS = [
  ...Object.keys(COLUMN_KEYS).filter(c => c !== 'history'),
  'local_storage_backup',
  'updated_at'
].join(', ');

// Keys local_storage_backup never overwrites or prunes: device-local, or synced through their own
// column or merge logic. (Rows written by older app versions still carry column keys in the backup.)
// Keys never uploaded in local_storage_backup: they sync through their own table.
const LOCAL_ONLY_KEYS = new Set([NUTRITION_LOG_KEY, NUTRITION_TOMBSTONES_KEY]);
const BACKUP_SKIP_KEYS = new Set([
  'iron_active_day',
  HISTORY_TOMBSTONES_KEY,
  ...LOCAL_ONLY_KEYS,
  ...Object.values(COLUMN_KEYS)
]);

const isList = v => Array.isArray(v);
const isMap = v => !!v && typeof v === 'object';
const isText = v => typeof v === 'string'; // including '', so a cleared field clears everywhere
// Which values each column may hold. Anything else (including null: never set) says nothing about the key.
const COLUMN_VALID = {
  microcycle_config: isList,
  custom_days: isList,
  custom_sections: isList,
  hidden_days: isList,
  custom_exercises: isList,
  hidden_exercises: isList,
  custom_variations: isMap,
  hidden_variations: isMap,
  var_order: isMap,
  exercise_orders: isMap,
  section_orders: isMap,
  profile_name: isText,
  profile_age: isText,
  profile_weight: isText,
  profile_height: isText,
  profile_sex: isText,
  profile_avatar: v => isText(v) && v !== ''
};
const COLUMN_KEY_SET = new Set(Object.values(COLUMN_KEYS));
const ABSENT = '-'; // fingerprint of a key that isn't set (real fingerprints contain a '.')

function settingFp(raw) {
  if (raw === null || raw === undefined) return ABSENT;
  let v = raw;
  try {
    v = JSON.parse(raw);
  } catch (e) {} // jsonb doesn't keep key order or formatting
  return fingerprint(v);
}

// The settings a user_sync row holds, as the raw strings localStorage would store.
// valueOf(key) is the raw string, null if the row says the key is unset, or undefined if it can't tell.
export function rowSettings(row) {
  const out = {};
  const backup = isMap(row.local_storage_backup) ? row.local_storage_backup : null;
  if (backup) {
    for (const k in backup) {
      if (k.startsWith('iron_') && !BACKUP_SKIP_KEYS.has(k) && backup[k] !== null) out[k] = String(backup[k]);
    }
  }
  for (const [col, key] of Object.entries(COLUMN_KEYS)) {
    if (!COLUMN_VALID[col] || !COLUMN_VALID[col](row[col])) continue;
    out[key] = isText(row[col]) ? row[col] : JSON.stringify(row[col]);
  }
  // Per-section exercise orders also travel inside exercise_orders.
  if (isMap(row.exercise_orders)) {
    for (const k in row.exercise_orders) {
      if (k.startsWith('iron_order_') && !(k in out)) out[k] = JSON.stringify(row.exercise_orders[k]);
    }
  }
  // A key the backup leaves out is not set in the cloud; a column key left out is unknown.
  const valueOf = k => (k in out ? out[k] : backup && !COLUMN_KEY_SET.has(k) ? null : undefined);
  return { keys: Object.keys(out), valueOf };
}

// The user_sync row this device's settings would upload as.
export function buildSyncPayload(userId, updatedAt) {
  const allLocalStorageData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('iron_') && !COLUMN_KEY_SET.has(key) && !LOCAL_ONLY_KEYS.has(key)) {
      allLocalStorageData[key] = localStorage.getItem(key);
    }
  }

  return {
    user_id: userId,
    microcycle_config: getMicrocycle(),
    custom_days: getJ('iron_custom_days', []),
    custom_sections: getJ('iron_custom_sections', []),
    hidden_days: getJ('iron_hidden_days', []),
    custom_exercises: getJ('iron_custom_exercises', []),
    hidden_exercises: getJ('iron_hidden_exercises', []),
    custom_variations: getJ('iron_custom_variations', {}),
    hidden_variations: getJ('iron_hidden_variations', {}),
    var_order: getJ('iron_var_order', {}),
    exercise_orders: getJ('iron_all_exercise_orders', {}),
    section_orders: getJ('iron_section_orders', {}),
    local_storage_backup: allLocalStorageData,
    profile_name: getL('iron_profile_name', ''),
    profile_age: getL('iron_profile_age', ''),
    profile_weight: getL('iron_profile_weight', ''),
    profile_height: getL('iron_profile_height', ''),
    profile_sex: getL('iron_profile_sex', ''),
    profile_avatar: getL('iron_profile_avatar', null),
    updated_at: updatedAt
  };
}

// Remembers `row` as the cloud's current settings.
export function recordSynced(row) {
  const { keys, valueOf } = rowSettings(row);
  const synced = getJ(SYNCED_FPS_KEY, {}) || {};
  for (const k of new Set([...Object.keys(synced), ...keys])) {
    const raw = valueOf(k);
    if (raw === undefined) continue;
    if (raw === null) delete synced[k];
    else synced[k] = settingFp(raw);
  }
  setJ(SYNCED_FPS_KEY, synced);
  localStorage.removeItem(LEGACY_SYNCED_KEYS_KEY);
}

// Whether the cloud already holds every setting in `payload`, as of this device's last sync.
// (A value recordSynced can't tell, like an unset avatar, counts as unchanged, as it does there.)
export function matchesSynced(payload) {
  const synced = getJ(SYNCED_FPS_KEY, null);
  if (!synced) return false; // no fingerprints yet (first sync, or updated from an older version)
  const { keys, valueOf } = rowSettings(payload);
  for (const k of new Set([...Object.keys(synced), ...keys])) {
    const raw = valueOf(k);
    if (raw !== undefined && settingFp(raw) !== (synced[k] ?? ABSENT)) return false;
  }
  return true;
}

// Applies another device's changes from a cloud row. A setting changed in the cloud since this device's
// last sync is taken, unless keepLocalEdits is set and this device changed it too (its edit uploads next).
// Returns whether any local setting changed.
export function mergeCloudRow(row, { keepLocalEdits = false } = {}) {
  const { keys, valueOf } = rowSettings(row);
  const synced = getJ(SYNCED_FPS_KEY, null);
  const legacySynced = new Set(getJ(LEGACY_SYNCED_KEYS_KEY, []));
  // Local values as an upload would send them (unset columns go up as their defaults).
  const mine = rowSettings(buildSyncPayload(null, null));

  let changed = false;
  for (const k of new Set([...keys, ...mine.keys, ...Object.keys(synced || {})])) {
    const remote = valueOf(k);
    if (remote === undefined) continue;
    const local = mine.valueOf(k) ?? localStorage.getItem(k);
    const remoteFp = settingFp(remote),
      localFp = settingFp(local);
    if (remoteFp === localFp) continue;
    let baseFp;
    if (synced) baseFp = synced[k] ?? ABSENT;
    // First sync since updating from a version without fingerprints.
    else if (keepLocalEdits)
      baseFp = local === null ? ABSENT : remoteFp; // keep every local value, add the cloud's new keys
    else baseFp = legacySynced.has(k) || remote !== null ? localFp : ABSENT; // nothing unsynced: local is what was synced

    const remoteChanged = remoteFp !== baseFp,
      localChanged = localFp !== baseFp;
    if (!remoteChanged || (keepLocalEdits && localChanged)) continue;
    if (remote === null) localStorage.removeItem(k);
    else setL(k, remote);
    changed = true;
  }
  recordSynced(row);
  return changed;
}
