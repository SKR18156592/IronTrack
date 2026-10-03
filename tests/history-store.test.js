// @vitest-environment happy-dom
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ui.js', () => ({ showToast: vi.fn() }));

const s = (ms) => ({ id: 'session_' + ms, date: '2026-01-01', exercises: [] });
const ids = (list) => list.map(r => r.id);

// A fresh module copy each time stands in for a page reload; IndexedDB itself persists.
const reload = async () => {
  vi.resetModules();
  const store = await import('../src/history-store.js');
  await store.loadHistory();
  return store;
};

beforeEach(() => {
  localStorage.clear();
  globalThis.indexedDB = new IDBFactory();
});

describe('history store', () => {
  it('keeps history in IndexedDB across reloads, not localStorage', async () => {
    let store = await reload();
    store.setHistory([s(2), s(1)]);
    await store.flushHistory();
    expect(localStorage.getItem('iron_workout_history')).toBeNull();
    store = await reload();
    expect(ids(store.getHistory())).toEqual(['session_2', 'session_1']);
  });

  it('moves existing localStorage history into IndexedDB', async () => {
    localStorage.setItem('iron_workout_history', JSON.stringify([s(1)]));
    let store = await reload();
    expect(ids(store.getHistory())).toEqual(['session_1']);
    expect(localStorage.getItem('iron_workout_history')).toBeNull();
    store = await reload();
    expect(ids(store.getHistory())).toEqual(['session_1']);
  });

  it('merges instead of replacing when a move was interrupted', async () => {
    let store = await reload();
    store.setHistory([s(2)]);
    await store.flushHistory();
    localStorage.setItem('iron_workout_history', JSON.stringify([s(1)]));
    store = await reload();
    expect(ids(store.getHistory())).toEqual(['session_2', 'session_1']);
  });

  it('does not bring back sessions deleted before the move', async () => {
    let store = await reload();
    store.setHistory([s(2)]);
    await store.flushHistory();
    localStorage.setItem('iron_workout_history', JSON.stringify([s(1)]));
    localStorage.setItem('iron_history_tombstones', JSON.stringify(['session_2']));
    store = await reload();
    expect(ids(store.getHistory())).toEqual(['session_1']);
  });

  it('hands out copies, so callers cannot change the stored history by accident', async () => {
    const store = await reload();
    store.setHistory([s(1)]);
    store.getHistory()[0].notes = 'changed';
    store.getHistory().push(s(2));
    expect(store.getHistory()).toEqual([s(1)]);
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    delete globalThis.indexedDB;
    localStorage.setItem('iron_workout_history', JSON.stringify([s(1)]));
    const store = await reload();
    expect(ids(store.getHistory())).toEqual(['session_1']);
    expect(store.setHistory([s(2), s(1)])).toBe(true);
    expect(ids(JSON.parse(localStorage.getItem('iron_workout_history')))).toEqual(['session_2', 'session_1']);
  });
});
