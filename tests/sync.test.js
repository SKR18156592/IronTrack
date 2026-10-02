// @vitest-environment happy-dom
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

const { applyCloudRow, flushPush, pullFromCloud, pushToCloud, setSyncContext } = await import('../src/sync.js');

const USER = { id: 'user-1' };
const history = () => JSON.parse(localStorage.getItem('iron_workout_history') || '[]');
const ids = (list) => list.map(s => s.id).sort();
const logSession = (ms) => {
  localStorage.setItem('iron_workout_history', JSON.stringify([{ id: 'session_' + ms, exercises: [] }, ...history()]));
  pushToCloud();
};

let server, pgTime;
beforeEach(() => {
  localStorage.clear();
  const fake = createFakeSupabase();
  server = fake.server;
  pgTime = fake.pgTime;
  setSyncContext({ client: fake.client, user: USER });
});

describe('flushPush', () => {
  it('creates the row on first sync and clears the unsynced flag', async () => {
    logSession(1);
    expect(await flushPush()).toBe(true);
    expect(ids(server.row.history)).toEqual(['session_1']);
    expect(localStorage.getItem('irontrack_sync_dirty')).toBeNull();
  });

  it('merges sessions another device uploaded instead of overwriting them', async () => {
    server.row = { user_id: USER.id, history: [{ id: 'session_2' }], local_storage_backup: {}, updated_at: pgTime('2026-01-01T00:00:00Z') };
    logSession(1);
    expect(await flushPush()).toBe(true);
    expect(ids(server.row.history)).toEqual(['session_1', 'session_2']);
    expect(ids(history())).toEqual(['session_1', 'session_2']);
  });

  it('re-reads and merges when the row changes between its read and write', async () => {
    server.row = { user_id: USER.id, history: [], local_storage_backup: {}, updated_at: pgTime('2026-01-01T00:00:00Z') };
    server.beforeUpdate = async () => {
      server.row = { ...server.row, history: [{ id: 'session_9' }], updated_at: pgTime('2026-01-01T00:00:05Z') };
    };
    logSession(1);
    expect(await flushPush()).toBe(true);
    expect(ids(server.row.history)).toEqual(['session_1', 'session_9']);
  });

  it('keeps edits marked unsynced when offline', async () => {
    server.offline = true;
    logSession(1);
    expect(await flushPush()).toBe(false);
    expect(localStorage.getItem('irontrack_sync_dirty')).toBe('1');
    server.offline = false;
    expect(await flushPush()).toBe(true);
    expect(ids(server.row.history)).toEqual(['session_1']);
  });

  it('uploads again when an edit lands while an upload is in flight', async () => {
    logSession(1);
    const first = flushPush();
    logSession(2); // edited mid-upload
    expect(await first).toBe(true);
    expect(await flushPush()).toBe(true);
    expect(ids(server.row.history)).toEqual(['session_1', 'session_2']);
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
  it('uploads unsynced local edits instead of overwriting them', async () => {
    server.row = { user_id: USER.id, history: [{ id: 'session_2' }], local_storage_backup: {}, updated_at: pgTime('2026-01-01T00:00:00Z') };
    logSession(1);
    await pullFromCloud();
    expect(ids(history())).toEqual(['session_1', 'session_2']);
    expect(ids(server.row.history)).toEqual(['session_1', 'session_2']);
  });
});

describe('applyCloudRow', () => {
  it('removes keys deleted on another device but keeps keys never synced', () => {
    localStorage.setItem('irontrack_synced_keys', JSON.stringify(['iron_preset_a', 'iron_theme']));
    localStorage.setItem('iron_preset_a', '[]');      // synced before, now gone from the cloud
    localStorage.setItem('iron_local_only', 'x');      // never synced
    localStorage.setItem('iron_custom_days', '[{"dayNum":"9"}]');
    applyCloudRow({ local_storage_backup: { iron_theme: 'lime' }, custom_days: [], history: [] });
    expect(localStorage.getItem('iron_preset_a')).toBeNull();
    expect(localStorage.getItem('iron_local_only')).toBe('x');
    expect(localStorage.getItem('iron_theme')).toBe('lime');
    expect(localStorage.getItem('iron_custom_days')).toBe('[]'); // set from its column
  });

  it('applies a cleared profile field', () => {
    localStorage.setItem('iron_profile_name', 'Alex');
    applyCloudRow({ local_storage_backup: {}, profile_name: '', history: [] });
    expect(localStorage.getItem('iron_profile_name')).toBe('');
  });

  it('reports local sessions the cloud is missing', () => {
    localStorage.setItem('iron_workout_history', JSON.stringify([{ id: 'session_1' }]));
    expect(applyCloudRow({ local_storage_backup: {}, history: [] })).toBe(true);
    expect(applyCloudRow({ local_storage_backup: {}, history: [{ id: 'session_1' }] })).toBe(false);
  });
});
