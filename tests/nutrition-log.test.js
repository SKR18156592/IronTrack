// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase.js';

// The sync engine refreshes the UI after applying data; the DOM isn't under test here.
vi.mock('../src/ui.js', async importOriginal => ({
  ...(await importOriginal()),
  showToast: vi.fn(),
  refreshAllUI: vi.fn(),
  refreshHistoryUI: vi.fn(),
  refreshNutritionUI: vi.fn()
}));
vi.mock('../src/render/profile.js', async importOriginal => ({
  ...(await importOriginal()),
  loadProfileTabUI: vi.fn(),
  shrinkStoredAvatar: vi.fn()
}));

const { flushPush, pullFromCloud, pushToCloud, setSyncContext } = await import('../src/sync.js');
const { loadHistory, clearHistory } = await import('../src/history-store.js');
const log = await import('../src/nutrition-log.js');

const USER = { id: 'user-1' };
const food = (date, kcal, p = 10) => ({
  type: 'food',
  date,
  name: 'Rice',
  amount: 100,
  unit: 'g',
  kcal,
  p,
  c: 20,
  f: 1
});

let server;
beforeEach(async () => {
  localStorage.clear();
  await Promise.all([loadHistory(), log.loadNutritionLog()]);
  clearHistory();
  log.clearNutritionLog();
  const fake = createFakeSupabase();
  server = fake.server;
  setSyncContext({ client: fake.client, user: USER });
});

describe('the nutrition log', () => {
  it('totals a day: food, water and the last weight logged', () => {
    log.addEntries([
      food('2026-10-04', 500, 30),
      food('2026-10-04', 250, 5),
      food('2026-10-03', 900),
      { type: 'water', date: '2026-10-04', ml: 250 },
      { type: 'water', date: '2026-10-04', ml: 500 },
      { type: 'weight', date: '2026-10-04', kg: 80.4 },
      { type: 'weight', date: '2026-10-04', kg: 80.1 }
    ]);
    expect(log.dayTotals(log.getNutritionLog(), '2026-10-04')).toEqual({
      kcal: 750,
      p: 35,
      c: 40,
      f: 2,
      water: 750,
      weight: 80.1
    });
  });

  it('keeps one weight per day, oldest first', () => {
    log.addEntries([
      { type: 'weight', date: '2026-10-04', kg: 80 },
      { type: 'weight', date: '2026-10-01', kg: 81 },
      { type: 'weight', date: '2026-10-04', kg: 79.8 }
    ]);
    expect(log.weightSeries(log.getNutritionLog())).toEqual([
      { date: '2026-10-01', kg: 81 },
      { date: '2026-10-04', kg: 79.8 }
    ]);
  });

  it('steps dates across month ends in local time', () => {
    expect(log.shiftDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(log.shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('syncing the nutrition log', () => {
  it('uploads each entry as its own nutrition_log row, never through the settings row', async () => {
    const [entry] = log.addEntries([food('2026-10-04', 500)]);
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(server.nutrition.get(entry.id).data).toEqual(entry);
    log.removeEntry(log.addEntries([food('2026-10-04', 100)])[0].id); // a tombstone too
    pushToCloud();
    expect(await flushPush()).toBe(true);
    const backup = Object.keys(server.row.local_storage_backup);
    expect(backup.filter(k => k.startsWith('iron_nutrition'))).toEqual([]);
  });

  it('takes entries logged on another device', async () => {
    pushToCloud();
    await flushPush();
    server.putNutrition({
      user_id: USER.id,
      id: 'n_other',
      data: { id: 'n_other', ...food('2026-10-04', 300), at: 1 }
    });
    await pullFromCloud();
    expect(log.getNutritionLog().map(e => e.id)).toEqual(['n_other']);
  });

  it('uploads deletions so other devices drop the entry too', async () => {
    const [entry] = log.addEntries([food('2026-10-04', 500)]);
    pushToCloud();
    await flushPush();
    log.removeEntry(entry.id);
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(server.nutrition.get(entry.id).deleted).toBe(true);
  });

  it('keeps the log on the device, and everything else syncing, until the table exists', async () => {
    server.missingTables.add('nutrition_log');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [entry] = log.addEntries([food('2026-10-04', 500)]);
    localStorage.setItem('iron_theme', 'lime');
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(server.row.local_storage_backup.iron_theme).toBe('lime');
    expect(log.getNutritionLog().map(e => e.id)).toEqual([entry.id]);

    server.missingTables.clear(); // the SQL has been run: the entry goes up on the next sync
    pushToCloud();
    expect(await flushPush()).toBe(true);
    expect(server.nutrition.has(entry.id)).toBe(true);
  });
});
