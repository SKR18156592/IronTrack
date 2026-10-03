// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase.js';

// The sync engine refreshes the UI after applying data; the DOM isn't under test here.
vi.mock('../src/ui.js', async (importOriginal) => ({
  ...(await importOriginal()),
  showToast: vi.fn(), refreshAllUI: vi.fn(), refreshHistoryUI: vi.fn()
}));
vi.mock('../src/render/profile.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadProfileTabUI: vi.fn(), shrinkStoredAvatar: vi.fn()
}));

const { mergeCloudRow, flushPush, pullFromCloud, pushToCloud, setSyncContext } = await import('../src/sync.js');
const { clearHistory, getHistory, loadHistory, setHistory } = await import('../src/history-store.js');

const USER = { id: 'user-1' };
const history = () => getHistory();
const ids = (list) => list.map(s => s.id).sort();
const session = (ms) => ({ id: 'session_' + ms, exercises: [] });
const logSession = (ms) => {
  setHistory([session(ms), ...history()]);
  pushToCloud();
};
// Sessions the cloud has, and those it has as deleted.
const cloudIds = () => [...server.sessions.values()].filter(r => !r.deleted).map(r => r.id).sort();
const cloudDeleted = () => [...server.sessions.values()].filter(r => r.deleted).map(r => r.id).sort();
const tombstones = () => JSON.parse(localStorage.getItem('iron_history_tombstones') || '[]');

let server, pgTime;
beforeEach(async () => {
  localStorage.clear();
  await loadHistory();
  clearHistory();
  const fake = createFakeSupabase();
  server = fake.server;
  pgTime = fake.pgTime;
  setSyncContext({ client: fake.client, user: USER });
});

describe('flushPush', () => {
  it('creates the row on first sync, uploads each session as its own row, and clears the unsynced flag', async () => {
    logSession(1);
    expect(await flushPush()).toBe(true);
    expect(cloudIds()).toEqual(['session_1']);
    expect(server.row).not.toHaveProperty('history');
    expect(localStorage.getItem('irontrack_sync_dirty')).toBeNull();
  });

  it('uploads only sessions the cloud does not have yet', async () => {
    logSession(1);
    await flushPush();
    logSession(2);
    server.uploaded = [];
    await flushPush();
    expect(server.uploaded).toEqual(['session_2']);
  });

  it('uploads a session again after it changes', async () => {
    logSession(1);
    await flushPush();
    setHistory([{ ...session(1), notes: 'felt strong' }]);
    pushToCloud();
    server.uploaded = [];
    await flushPush();
    expect(server.uploaded).toEqual(['session_1']);
    expect(server.sessions.get('session_1').data.notes).toBe('felt strong');
  });

  it('keeps sessions another device uploaded', async () => {
    server.putSession({ id: 'session_2', data: session(2) });
    logSession(1);
    expect(await flushPush()).toBe(true);
    expect(cloudIds()).toEqual(['session_1', 'session_2']);
    expect(ids(history())).toEqual(['session_1', 'session_2']);
  });

  it('uploads deletions so other devices drop the sessions too', async () => {
    logSession(1);
    logSession(2);
    await flushPush();
    localStorage.setItem('iron_history_tombstones', JSON.stringify(['session_1']));
    setHistory([session(2)]);
    pushToCloud();
    await flushPush();
    expect(cloudIds()).toEqual(['session_2']);
    expect(cloudDeleted()).toEqual(['session_1']);
  });

  it('re-reads the settings row when it changes between its read and write', async () => {
    server.row = { user_id: USER.id, local_storage_backup: {}, updated_at: pgTime('2026-01-01T00:00:00Z') };
    server.beforeUpdate = async () => {
      server.row = { ...server.row, updated_at: pgTime('2026-01-01T00:00:05Z') };
    };
    localStorage.setItem('iron_theme', 'cyan');
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(server.row.local_storage_backup.iron_theme).toBe('cyan');
  });

  it('keeps edits marked unsynced when offline', async () => {
    server.offline = true;
    logSession(1);
    expect(await flushPush()).toBe(false);
    expect(localStorage.getItem('irontrack_sync_dirty')).toBe('1');
    server.offline = false;
    expect(await flushPush()).toBe(true);
    expect(cloudIds()).toEqual(['session_1']);
  });

  it('uploads again when an edit lands while an upload is in flight', async () => {
    logSession(1);
    const first = flushPush();
    logSession(2); // edited mid-upload
    expect(await first).toBe(true);
    expect(await flushPush()).toBe(true);
    expect(cloudIds()).toEqual(['session_1', 'session_2']);
    expect(localStorage.getItem('irontrack_sync_dirty')).toBeNull();
  });

  it('does not upload column-backed keys twice', async () => {
    localStorage.setItem('iron_custom_days', '[]');
    localStorage.setItem('iron_theme', 'cyan');
    logSession(1);
    await flushPush();
    expect(Object.keys(server.row.local_storage_backup)).toContain('iron_theme');
    expect(Object.keys(server.row.local_storage_backup)).not.toContain('iron_workout_history');
    expect(Object.keys(server.row.local_storage_backup)).not.toContain('iron_custom_days');
  });
});

describe('pullFromCloud', () => {
  const row = (extra = {}) => ({ user_id: USER.id, local_storage_backup: {}, updated_at: pgTime('2026-01-01T00:00:00Z'), ...extra });

  it('uploads unsynced local edits instead of overwriting them', async () => {
    server.row = row();
    server.putSession({ id: 'session_2', data: session(2) });
    logSession(1);
    await pullFromCloud();
    expect(ids(history())).toEqual(['session_1', 'session_2']);
    expect(cloudIds()).toEqual(['session_1', 'session_2']);
  });

  it('after the first pull, reads only sessions changed since the last one', async () => {
    server.row = row();
    server.putSession({ id: 'session_1', data: session(1) });
    await pullFromCloud();
    server.putSession({ id: 'session_2', data: session(2) });
    await pullFromCloud();
    expect(server.sessionReads[0]).toBeNull();
    expect(server.sessionReads.at(-1)).not.toBeNull();
    expect(ids(history())).toEqual(['session_1', 'session_2']);
  });

  it('applies deletions made on another device', async () => {
    server.row = row();
    logSession(1);
    await flushPush();
    server.putSession({ id: 'session_1', deleted: true });
    await pullFromCloud();
    expect(history()).toEqual([]);
    expect(tombstones()).toContain('session_1');
  });

  it('takes another device\'s edit to a session this device already synced', async () => {
    server.row = row();
    logSession(1);
    await flushPush();
    server.putSession({ id: 'session_1', data: { ...session(1), notes: 'edited elsewhere' } });
    await pullFromCloud();
    expect(history()[0].notes).toBe('edited elsewhere');
  });

  it('pulls more sessions than fit in one page', async () => {
    server.row = row();
    for (let i = 1; i <= 1200; i++) server.putSession({ id: 'session_' + i, data: session(i) });
    await pullFromCloud();
    expect(history()).toHaveLength(1200);
    expect(history()[0].id).toBe('session_1200'); // newest first
  });
});

describe('moving history out of user_sync.history', () => {
  const row = (extra = {}) => ({ user_id: USER.id, local_storage_backup: {}, updated_at: pgTime('2026-01-01T00:00:00Z'), ...extra });

  it('merges the old history column once and uploads it as rows', async () => {
    server.row = row({
      history: [session(1), session(2)],
      local_storage_backup: { iron_history_tombstones: '["session_2"]' }
    });
    await pullFromCloud();
    expect(ids(history())).toEqual(['session_1']);
    expect(cloudIds()).toEqual(['session_1']);
    expect(cloudDeleted()).toEqual(['session_2']);

    server.row.history = [session(1), session(3)]; // an old-version device writes the column later
    await pullFromCloud();
    expect(ids(history())).toEqual(['session_1']);
  });

  it('does not bring back sessions an updated device has deleted since', async () => {
    server.row = row({ history: [session(1)] });
    server.putSession({ id: 'session_1', deleted: true });
    await pullFromCloud();
    expect(history()).toEqual([]);
    expect(cloudDeleted()).toEqual(['session_1']);
  });

  it('retries on the next sync if the move was interrupted', async () => {
    server.row = row({ history: [session(1)] });
    server.offline = true;
    await pullFromCloud();
    expect(localStorage.getItem('irontrack_sessions_migrated')).toBeNull();
    server.offline = false;
    await pullFromCloud();
    expect(cloudIds()).toEqual(['session_1']);
    expect(localStorage.getItem('irontrack_sessions_migrated')).toBe(USER.id);
  });
});

describe('mergeCloudRow', () => {
  it('removes keys deleted on another device but keeps keys never synced', () => {
    localStorage.setItem('irontrack_synced_keys', JSON.stringify(['iron_preset_a', 'iron_theme']));
    localStorage.setItem('iron_preset_a', '[]');      // synced before, now gone from the cloud
    localStorage.setItem('iron_local_only', 'x');      // never synced
    localStorage.setItem('iron_custom_days', '[{"dayNum":"9"}]');
    mergeCloudRow({ local_storage_backup: { iron_theme: 'lime' }, custom_days: [] });
    expect(localStorage.getItem('iron_preset_a')).toBeNull();
    expect(localStorage.getItem('iron_local_only')).toBe('x');
    expect(localStorage.getItem('iron_theme')).toBe('lime');
    expect(localStorage.getItem('iron_custom_days')).toBe('[]'); // set from its column
  });

  it('applies a cleared profile field', () => {
    localStorage.setItem('iron_profile_name', 'Alex');
    mergeCloudRow({ local_storage_backup: {}, profile_name: '' });
    expect(localStorage.getItem('iron_profile_name')).toBe('');
  });

  it('leaves workout history alone', () => {
    setHistory([session(1)]);
    mergeCloudRow({ local_storage_backup: {}, history: [session(9)] });
    expect(ids(history())).toEqual(['session_1']);
  });
});

describe('settings changed on two devices', () => {
  // Another device uploads its settings: `backup` replaces the row's local_storage_backup.
  const otherDeviceWrites = (backup, columns = {}) => {
    server.row = { ...server.row, ...columns, local_storage_backup: backup, updated_at: pgTime(new Date(Date.parse(server.row.updated_at) + 5000).toISOString()) };
  };
  const syncedBackup = () => ({ ...server.row.local_storage_backup });

  beforeEach(async () => {
    localStorage.setItem('iron_theme', 'cyan');
    localStorage.setItem('iron_preset_squat_bar', '[[100,5,2,"Working"]]');
    pushToCloud();
    expect(await flushPush()).toBe(true);
  });

  it('an unsynced edit here keeps a setting another device added meanwhile', async () => {
    otherDeviceWrites({ ...syncedBackup(), iron_preset_bench_flat: '[[60,8,2,"Working"]]' });
    localStorage.setItem('iron_theme', 'lime'); // edited here while offline
    pushToCloud();
    await pullFromCloud();
    expect(server.row.local_storage_backup.iron_preset_bench_flat).toBe('[[60,8,2,"Working"]]');
    expect(server.row.local_storage_backup.iron_theme).toBe('lime');
    expect(localStorage.getItem('iron_preset_bench_flat')).toBe('[[60,8,2,"Working"]]');
  });

  it('applies a deletion from another device even with unrelated unsynced edits here', async () => {
    const { iron_preset_squat_bar, ...rest } = syncedBackup();
    otherDeviceWrites(rest);
    localStorage.setItem('iron_theme', 'lime');
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(localStorage.getItem('iron_preset_squat_bar')).toBeNull();
    expect(server.row.local_storage_backup).not.toHaveProperty('iron_preset_squat_bar');
  });

  it('keeps the edit made here when both devices changed the same setting', async () => {
    otherDeviceWrites({ ...syncedBackup(), iron_theme: 'rose' });
    localStorage.setItem('iron_theme', 'lime');
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(localStorage.getItem('iron_theme')).toBe('lime');
    expect(server.row.local_storage_backup.iron_theme).toBe('lime');
  });

  it('uploads a deletion made here instead of restoring the key from the cloud', async () => {
    otherDeviceWrites({ ...syncedBackup(), iron_preset_bench_flat: '[]' });
    localStorage.removeItem('iron_preset_squat_bar');
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(localStorage.getItem('iron_preset_squat_bar')).toBeNull();
    expect(server.row.local_storage_backup).not.toHaveProperty('iron_preset_squat_bar');
    expect(server.row.local_storage_backup.iron_preset_bench_flat).toBe('[]');
  });

  it('merges column-backed settings too', async () => {
    otherDeviceWrites(syncedBackup(), { hidden_days: ['3'] });
    localStorage.setItem('iron_profile_name', 'Alex');
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(localStorage.getItem('iron_hidden_days')).toBe('["3"]');
    expect(server.row.hidden_days).toEqual(['3']);
    expect(server.row.profile_name).toBe('Alex');
  });

  it('on a clean pull, takes the cloud\'s changes', async () => {
    otherDeviceWrites({ ...syncedBackup(), iron_theme: 'rose' });
    await pullFromCloud();
    expect(localStorage.getItem('iron_theme')).toBe('rose');
  });

  it('after updating from the older version, an unsynced edit still keeps the cloud\'s new keys', async () => {
    localStorage.removeItem('irontrack_synced_fps');
    localStorage.setItem('irontrack_synced_keys', JSON.stringify(Object.keys(syncedBackup())));
    otherDeviceWrites({ ...syncedBackup(), iron_preset_bench_flat: '[]' });
    localStorage.setItem('iron_theme', 'lime');
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(server.row.local_storage_backup.iron_preset_bench_flat).toBe('[]');
    expect(server.row.local_storage_backup.iron_theme).toBe('lime');
  });
});
