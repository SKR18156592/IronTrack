// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
// Imported first, as the app does: loaded first, history-store.js would reach settings-merge.js through
// an import cycle (storage → ui → model → sync) before its own constants exist.
import { buildSyncPayload, matchesSynced, mergeCloudRow, recordSynced, rowSettings } from '../src/settings-merge.js';
import { clearHistory, getHistory, loadHistory, setHistory } from '../src/history-store.js';

const session = ms => ({ id: 'session_' + ms, exercises: [] });

beforeEach(async () => {
  localStorage.clear();
  await loadHistory();
  clearHistory();
});

describe('rowSettings', () => {
  it('takes column values over the stale copies older versions left in the backup', () => {
    const { valueOf } = rowSettings({
      local_storage_backup: { iron_custom_days: '[{"dayNum":"1"}]', iron_theme: 'lime' },
      custom_days: [{ dayNum: '2' }]
    });
    expect(valueOf('iron_custom_days')).toBe('[{"dayNum":"2"}]');
    expect(valueOf('iron_theme')).toBe('lime');
  });

  it('reads per-section exercise orders from exercise_orders', () => {
    const { valueOf } = rowSettings({ local_storage_backup: {}, exercise_orders: { iron_order_push: ['a', 'b'] } });
    expect(valueOf('iron_order_push')).toBe('["a","b"]');
  });

  it('tells an unset key (null) from one the row says nothing about (undefined)', () => {
    const { valueOf } = rowSettings({ local_storage_backup: {}, profile_avatar: '' });
    expect(valueOf('iron_theme')).toBeNull(); // not in the backup: unset in the cloud
    expect(valueOf('iron_custom_days')).toBeUndefined(); // column missing from the row
    expect(valueOf('iron_profile_avatar')).toBeUndefined(); // an empty avatar is never a real value
    expect(rowSettings({}).valueOf('iron_theme')).toBeUndefined(); // no backup at all
  });

  it('never reads device-local keys or tombstones from the backup', () => {
    const { keys } = rowSettings({
      local_storage_backup: { iron_active_day: '3', iron_history_tombstones: '["x"]', other_app_key: '1' }
    });
    expect(keys).toEqual([]);
  });
});

describe('matchesSynced', () => {
  it('is false before the first sync', () => {
    expect(matchesSynced(buildSyncPayload('user-1', null))).toBe(false);
  });

  it('is true once the payload is recorded, until a setting changes or is removed', () => {
    localStorage.setItem('iron_theme', 'cyan');
    localStorage.setItem('iron_preset_squat', '[[100,5]]');
    recordSynced(buildSyncPayload('user-1', null));
    expect(matchesSynced(buildSyncPayload('user-1', null))).toBe(true);

    localStorage.setItem('iron_theme', 'lime');
    expect(matchesSynced(buildSyncPayload('user-1', null))).toBe(false);

    localStorage.setItem('iron_theme', 'cyan');
    localStorage.removeItem('iron_preset_squat');
    expect(matchesSynced(buildSyncPayload('user-1', null))).toBe(false);
  });

  it('ignores key order, which jsonb does not keep', () => {
    localStorage.setItem('iron_custom_variations', '{"a":1,"b":2}');
    recordSynced(buildSyncPayload('user-1', null));
    localStorage.setItem('iron_custom_variations', '{"b":2,"a":1}');
    expect(matchesSynced(buildSyncPayload('user-1', null))).toBe(true);
  });
});

describe('mergeCloudRow', () => {
  it('removes keys deleted on another device but keeps keys never synced', () => {
    localStorage.setItem('irontrack_synced_keys', JSON.stringify(['iron_preset_a', 'iron_theme']));
    localStorage.setItem('iron_preset_a', '[]'); // synced before, now gone from the cloud
    localStorage.setItem('iron_local_only', 'x'); // never synced
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
    expect(getHistory().map(s => s.id)).toEqual(['session_1']);
  });

  it('keeps the day this device has open', () => {
    localStorage.setItem('iron_active_day', '2');
    mergeCloudRow({ local_storage_backup: { iron_active_day: '5' } });
    expect(localStorage.getItem('iron_active_day')).toBe('2');
  });

  it('reports whether anything changed', () => {
    const row = { local_storage_backup: { iron_theme: 'lime' } };
    expect(mergeCloudRow(row)).toBe(true);
    expect(mergeCloudRow(row)).toBe(false);
  });
});
