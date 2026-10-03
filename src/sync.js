import { confirmDialog } from './dialog.js';
import { createClient } from '@supabase/supabase-js';
import { HISTORY_KEY, HISTORY_TOMBSTONES_KEY, clearHistory, flushHistory, loadHistory } from './history-store.js';
import {
  SESSIONS_CURSOR_KEY,
  SESSIONS_MIGRATED_KEY,
  SESSIONS_SYNCED_KEY,
  fingerprint,
  syncSessions
} from './session-sync.js';
import { getMicrocycle } from './model.js';
import { loadProfileTabUI, shrinkStoredAvatar } from './render/profile.js';
import { getJ, getL, setJ, setL } from './storage.js';
import { refreshAllUI, refreshHistoryUI, showToast, updateSyncIndicator } from './ui.js';

// ==========================================
// SUPABASE CLIENT & AUTH CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://jlwaebsftvtqghmhhess.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsd2FlYnNmdHZ0cWdobWhoZXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mjk1OTgsImV4cCI6MjEwNDAwNTU5OH0.6bb0zIkWxUpX31KIckqNVWVBb0p2QRhl10yeUlA5e_g';

export let supabaseClient = null;
try {
  if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
} catch (e) {
  console.warn('Supabase initialization fallback active');
}

let isSignUpMode = false;
let isSigningOut = false;
export let currentUser = null;
let syncChannel = null;

// Test seam: lets unit tests drive the sync engine with a fake client and user, without the auth UI.
export function setSyncContext({ client, user }) {
  supabaseClient = client;
  currentUser = user;
}

export function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('authTitle').textContent = isSignUpMode ? 'Create an account' : 'Sign in to sync';
  document.getElementById('authSubmitBtn').textContent = isSignUpMode ? 'Create account' : 'Sign in';
  document.getElementById('authToggleText').textContent = isSignUpMode
    ? 'Already have an account?'
    : 'Need an account?';
}

export async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const msg = document.getElementById('authMsg');
  const btn = document.getElementById('authSubmitBtn');

  if (!supabaseClient) {
    msg.textContent = 'Supabase client unavailable. Running local standalone mode.';
    msg.style.color = 'var(--accent)';
    msg.style.display = 'block';
    setTimeout(() => {
      document.getElementById('authOverlay').classList.remove('active');
      document.getElementById('userBar').style.display = 'flex';
    }, 1200);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Processing...';
  msg.style.display = 'none';

  let res;
  try {
    if (isSignUpMode) {
      res = await supabaseClient.auth.signUp({ email, password });
    } else {
      res = await supabaseClient.auth.signInWithPassword({ email, password });
    }
  } catch (err) {
    // Usually returned as res.error, but a thrown error must not leave the button stuck on "Processing...".
    res = { error: { message: err?.message || 'Could not reach the server. Try again.' } };
  } finally {
    btn.disabled = false;
    btn.textContent = isSignUpMode ? 'Create account' : 'Sign in';
  }

  if (res.error) {
    msg.textContent = res.error.message;
    msg.style.color = '#ef4444';
    msg.style.display = 'block';
    showToast(res.error.message, 'error');
  } else if (res.data.session) {
    currentUser = res.data.session.user;
    await loadHistory();
    prepareLocalDataFor(currentUser);
    updateUserSessionUI(currentUser);
    await pullFromCloud();
    subscribeToRealtimeSync();
    showToast('Successfully signed in!', 'success');
  } else if (res.data.user && !res.data.session) {
    msg.textContent = 'Account created successfully!';
    msg.style.color = 'var(--accent)';
    msg.style.display = 'block';
  }
}

export async function handleSignOut() {
  if (currentUser && supabaseClient && !(await flushPush())) {
    const discard = await confirmDialog(
      'Some changes have not reached the cloud yet (you may be offline).\n\nSign out anyway and discard them from this device?',
      { confirmLabel: 'Sign out', danger: true }
    );
    if (!discard) return;
  }
  isSigningOut = true;
  if (syncChannel && supabaseClient) {
    supabaseClient.removeChannel(syncChannel);
    syncChannel = null;
  }
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.auth.signOut();
      // Offline: the server call fails and the session would survive, so drop it locally.
      if (error) await supabaseClient.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Sign-out error:', e);
    }
  }
  currentUser = null;
  // The next person to sign in on this device must not inherit this account's data.
  clearLocalUserData();
  localStorage.removeItem(AUTH_SKIPPED_KEY);
  await flushHistory(); // the reload must not cut off the history wipe
  window.location.reload();
}

// Signing in is optional: the app works fully on this device without an account.
const AUTH_SKIPPED_KEY = 'irontrack_auth_skipped'; // '1' once the user chose to continue without an account

export function skipSignIn() {
  setL(AUTH_SKIPPED_KEY, '1');
  document.getElementById('authOverlay').classList.remove('active');
}

export function openSignIn() {
  document.getElementById('authOverlay').classList.add('active');
  document.getElementById('authEmail')?.focus();
}

export function updateUserSessionUI(user) {
  const overlay = document.getElementById('authOverlay');
  const userBar = document.getElementById('userBar');
  userBar.style.display = 'flex'; // the profile stays reachable when signed out
  document.getElementById('accountSignedIn').style.display = user ? 'flex' : 'none';
  document.getElementById('accountSignedOut').style.display = user ? 'none' : 'flex';
  document.getElementById('manualSyncBtn').style.display = user ? '' : 'none';
  if (user) {
    overlay.classList.remove('active');
    const profileEmail = document.getElementById('profileEmailField');
    if (profileEmail) profileEmail.value = user.email;
    const syncBadge = document.getElementById('profileSyncBadge');
    if (syncBadge) syncBadge.textContent = 'Cloud Synced';
  } else {
    overlay.classList.toggle('active', getL(AUTH_SKIPPED_KEY, '') !== '1');
  }
  updateSyncIndicator();
}

// ---- Sync bookkeeping. These keys are outside the iron_ namespace so they are never synced themselves.
const SYNC_DIRTY_KEY = 'irontrack_sync_dirty';
// '1' while local edits have not reached the cloud
const SYNC_OWNER_KEY = 'irontrack_owner';
// user id the local iron_* data belongs to
const SYNC_STAMP_KEY = 'irontrack_last_synced_at';
// updated_at of the last row we pushed or applied
export const SESSION_DRAFT_KEY = 'irontrack_session_draft';
// in-progress workout form; device-local, never synced
const SYNCED_FPS_KEY = 'irontrack_synced_fps';
// iron_* key -> fingerprint of its value in the cloud as of our last sync
const LEGACY_SYNCED_KEYS_KEY = 'irontrack_synced_keys';
// older versions: iron_* keys in the last snapshot synced
const PUSH_DEBOUNCE_MS = 800;
let pushTimer = null;
let pushInFlight = null;
let localEditSeq = 0;

export function isSyncDirty() {
  return getL(SYNC_DIRTY_KEY, '') === '1';
}

export function clearLocalUserData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('iron_')) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
  clearHistory();
  [
    SYNC_DIRTY_KEY,
    SYNC_OWNER_KEY,
    SYNC_STAMP_KEY,
    SESSION_DRAFT_KEY,
    SYNCED_FPS_KEY,
    LEGACY_SYNCED_KEYS_KEY,
    SESSIONS_CURSOR_KEY,
    SESSIONS_SYNCED_KEY,
    SESSIONS_MIGRATED_KEY
  ].forEach(k => localStorage.removeItem(k));
}

// Never let one account's local data leak into another account on a shared device.
export function prepareLocalDataFor(user) {
  const owner = getL(SYNC_OWNER_KEY, '');
  if (owner && owner !== user.id) {
    clearLocalUserData();
    refreshAllUI();
    loadProfileTabUI();
  }
  setL(SYNC_OWNER_KEY, user.id);
}

export async function pullFromCloud(showIndicator = false) {
  if (!currentUser || !supabaseClient) return;
  await loadHistory(); // merging into a not-yet-loaded history would drop the local sessions
  const syncBtn = document.getElementById('manualSyncBtn');
  const finish = (ok, message) => {
    const label = syncBtn && syncBtn.querySelector('.btn-label');
    if (label && showIndicator) {
      label.textContent = ok ? 'Synced' : 'Sync failed';
      setTimeout(() => {
        label.textContent = 'Sync now';
      }, 2000);
    }
    if (showIndicator) showToast(message, ok ? 'success' : 'error');
  };
  try {
    const syncLabel = syncBtn && syncBtn.querySelector('.btn-label');
    if (syncLabel && showIndicator) syncLabel.textContent = 'Syncing…';

    // Local edits that have not been uploaded yet win: upload them instead of overwriting them.
    if (isSyncDirty() || pushTimer || pushInFlight) {
      const ok = await flushPush();
      finish(
        ok,
        ok ? 'Data synchronized successfully!' : 'Offline: changes are saved on this device and will sync later.'
      );
      return;
    }

    const sessionsChanged = await syncSessions(supabaseClient, currentUser.id);
    if (sessionsChanged) refreshHistoryUI();

    const { data, error } = await supabaseClient
      .from('user_sync')
      .select(ROW_COLUMNS)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) {
      console.error('Cloud pull error:', error);
      finish(false, 'Sync failed: ' + error.message);
      return;
    }

    // The user edited something while the request was in flight: keep their edit.
    if (isSyncDirty() || pushTimer || pushInFlight) return;

    if (!data) {
      // First sync for this account: upload what this device has.
      setL(SYNC_DIRTY_KEY, '1');
      const ok = await flushPush();
      finish(ok, ok ? 'Data synchronized successfully!' : 'Sync failed.');
      return;
    }

    // Skip rows we already have (including the echo of our own push).
    if (isLastSyncedRow(data)) {
      finish(true, 'Already up to date.');
      return;
    }

    mergeCloudRow(data);
    if (data.updated_at) setL(SYNC_STAMP_KEY, data.updated_at);
    refreshAllUI();
    loadProfileTabUI();
    shrinkStoredAvatar();
    finish(true, 'Data synchronized successfully!');
  } catch (err) {
    console.error('Unexpected sync error:', err);
    finish(false, 'Sync error occurred.');
  }
}

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
const ROW_COLUMNS = [
  ...Object.keys(COLUMN_KEYS).filter(c => c !== 'history'),
  'local_storage_backup',
  'updated_at'
].join(', ');

// Keys local_storage_backup never overwrites or prunes: device-local, or synced through their own
// column or merge logic. (Rows written by older app versions still carry column keys in the backup.)
const BACKUP_SKIP_KEYS = new Set(['iron_active_day', HISTORY_TOMBSTONES_KEY, ...Object.values(COLUMN_KEYS)]);

// ---- Settings merge. Each synced setting is compared with its value in the cloud as of this device's
// last sync (kept as a fingerprint), so a sync takes another device's changes without dropping this
// device's unsynced ones. Workout history is not in the row: see session-sync.js.

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
function rowSettings(row) {
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

// Remembers `row` as the cloud's current settings.
function recordSynced(row) {
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

// Applies another device's changes from a cloud row. A setting changed in the cloud since this device's
// last sync is taken, unless keepLocalEdits is set and this device changed it too (its edit uploads next).
// Returns whether any local setting changed.
export function mergeCloudRow(row, { keepLocalEdits = false } = {}) {
  const { keys, valueOf } = rowSettings(row);
  const synced = getJ(SYNCED_FPS_KEY, null);
  const legacySynced = new Set(getJ(LEGACY_SYNCED_KEYS_KEY, []));
  // Local values as an upload would send them (unset columns go up as their defaults).
  const mine = rowSettings(buildSyncPayload(null));

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

function isLastSyncedRow(row) {
  const lastStamp = getL(SYNC_STAMP_KEY, '');
  return !!(row.updated_at && lastStamp && Date.parse(row.updated_at) === Date.parse(lastStamp));
}

// Called after every local edit. Marks local data as unsynced and schedules one debounced upload.
export function pushToCloud() {
  if (!currentUser || !supabaseClient) return;
  localEditSeq++;
  setL(SYNC_DIRTY_KEY, '1');
  updateSyncIndicator();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    flushPush();
  }, PUSH_DEBOUNCE_MS);
}

// Uploads pending local edits now. Uploads never overlap. Resolves true once nothing is left unsynced.
export async function flushPush() {
  clearTimeout(pushTimer);
  pushTimer = null;
  while (pushInFlight) await pushInFlight;
  if (!currentUser || !supabaseClient) return false;
  // Re-upload if the user edited again while an upload was running.
  while (isSyncDirty()) {
    if (pushInFlight) {
      await pushInFlight;
      continue;
    }
    pushInFlight = uploadSnapshot();
    let ok;
    try {
      ok = await pushInFlight;
    } finally {
      pushInFlight = null;
    }
    if (!ok) return false;
  }
  return true;
}

export function buildSyncPayload(updatedAt) {
  const columnKeys = new Set(Object.values(COLUMN_KEYS));
  const allLocalStorageData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('iron_') && !columnKeys.has(key)) {
      allLocalStorageData[key] = localStorage.getItem(key);
    }
  }

  return {
    user_id: currentUser?.id,
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

// Writes the row only if it is unchanged since `cloudRow` was read (compare-and-swap on updated_at).
// Resolves { written: false } when another device wrote first.
export async function writeSyncRow(payload, cloudRow) {
  if (!cloudRow) {
    const { error } = await supabaseClient.from('user_sync').insert(payload);
    if (error && error.code === '23505') return { written: false }; // another device created the row first
    return { written: !error, error };
  }
  let query = supabaseClient.from('user_sync').update(payload).eq('user_id', currentUser.id);
  query = cloudRow.updated_at ? query.eq('updated_at', cloudRow.updated_at) : query.is('updated_at', null);
  const { data, error } = await query.select('user_id');
  return { written: !error && Array.isArray(data) && data.length > 0, error };
}

const MAX_WRITE_ATTEMPTS = 3;

export async function uploadSnapshot() {
  await loadHistory();
  const seq = localEditSeq;
  let historyChanged = false;
  let settingsChanged = false;
  try {
    // Sessions first, so a device woken by the row change below finds them already uploaded.
    historyChanged = await syncSessions(supabaseClient, currentUser.id);
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      let { data: cloudRow, error: readError } = await supabaseClient
        .from('user_sync')
        .select('updated_at')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      // Another device wrote since our last sync: take its changes first, or this upload would undo them.
      if (!readError && cloudRow && !isLastSyncedRow(cloudRow)) {
        ({ data: cloudRow, error: readError } = await supabaseClient
          .from('user_sync')
          .select(ROW_COLUMNS)
          .eq('user_id', currentUser.id)
          .maybeSingle());
        if (!readError && cloudRow && mergeCloudRow(cloudRow, { keepLocalEdits: true })) settingsChanged = true;
      }
      if (readError) {
        console.error('Cloud read error:', readError);
        return false;
      }

      const updatedAt = new Date().toISOString();
      const payload = buildSyncPayload(updatedAt);
      let result = await writeSyncRow(payload, cloudRow);

      if (result.error && result.error.message) {
        const problematicCols = ['custom_sections', 'custom_days', 'hidden_days', 'microcycle_config'];
        let modified = false;
        problematicCols.forEach(col => {
          if (result.error.message.includes(col)) {
            delete payload[col];
            modified = true;
          }
        });
        if (modified) result = await writeSyncRow(payload, cloudRow);
      }

      if (result.error) {
        console.error('Cloud push error:', result.error);
        return false;
      }
      if (!result.written) continue; // the row changed under us: merge again and retry

      setL(SYNC_STAMP_KEY, updatedAt);
      recordSynced(payload);
      // Only clear the flag if nothing was edited while this upload was running.
      if (seq === localEditSeq) localStorage.removeItem(SYNC_DIRTY_KEY);

      if (syncChannel) {
        syncChannel.send({
          type: 'broadcast',
          event: 'iron_sync_ping',
          payload: { updated_at: updatedAt }
        });
      }
      return true;
    }
    console.warn('Cloud push skipped: the row kept changing; will retry on the next sync.');
    return false;
  } catch (err) {
    console.error('Unexpected push error:', err);
    return false;
  } finally {
    if (historyChanged) refreshHistoryUI();
    if (settingsChanged) {
      refreshAllUI();
      loadProfileTabUI();
      shrinkStoredAvatar();
    }
    updateSyncIndicator();
  }
}

// Resumes a saved session (if any) and starts syncing.
export function startSessionSync() {
  if (!supabaseClient) {
    updateUserSessionUI(null);
    document.getElementById('authOverlay').classList.remove('active');
    return;
  }
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      currentUser = session.user;
      prepareLocalDataFor(currentUser);
      updateUserSessionUI(currentUser);
      pullFromCloud();
      subscribeToRealtimeSync();
    } else {
      updateUserSessionUI(null);
    }
  });
  // Signed out in another tab, or the session could not be refreshed: in-memory state is stale.
  // Local data is kept (an unsynced edit uploads after the next sign-in to the same account).
  supabaseClient.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' && currentUser && !isSigningOut) window.location.reload();
  });
}

export function subscribeToRealtimeSync() {
  if (!currentUser || !supabaseClient) return;
  if (syncChannel) supabaseClient.removeChannel(syncChannel);

  syncChannel = supabaseClient
    .channel('user-sync-room-' + currentUser.id, { config: { broadcast: { self: false } } })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_sync',
        filter: `user_id=eq.${currentUser.id}`
      },
      async () => {
        await pullFromCloud(false);
      }
    )
    .on('broadcast', { event: 'iron_sync_ping' }, async () => {
      await pullFromCloud(false);
    })
    .subscribe();
}
