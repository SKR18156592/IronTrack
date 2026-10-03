// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ui.js', async (importOriginal) => ({
  ...(await importOriginal()),
  showToast: vi.fn(), refreshAllUI: vi.fn()
}));
vi.mock('../src/sync.js', async (importOriginal) => ({ ...(await importOriginal()), pushToCloud: vi.fn() }));

const { deleteWorkoutSession } = await import('../src/render/history.js');
const { clearHistory, getHistory, loadHistory, setHistory } = await import('../src/history-store.js');
const { pushToCloud } = await import('../src/sync.js');

const session = (ms) => ({ id: 'session_' + ms, date: '2026-10-0' + ms, day: '1', dayTitle: 'Chest', exercises: [] });
// The delete button lives inside the session's .log-item, which carries the session key.
const buttonFor = (key) => {
  const item = document.createElement('div');
  item.className = 'log-item';
  item.dataset.sessionKey = key;
  const btn = document.createElement('button');
  item.appendChild(btn);
  return btn;
};
const tombstones = () => JSON.parse(localStorage.getItem('iron_history_tombstones') || '[]');

beforeEach(async () => {
  localStorage.clear();
  await loadHistory();
  clearHistory();
  setHistory([session(2), session(1)]);
  vi.clearAllMocks();
});

describe('deleteWorkoutSession', () => {
  it('removes only that session and tombstones it so sync deletes it everywhere', () => {
    window.confirm = () => true;
    deleteWorkoutSession(buttonFor('session_1'));
    expect(getHistory().map(s => s.id)).toEqual(['session_2']);
    expect(tombstones()).toEqual(['session_1']);
    expect(pushToCloud).toHaveBeenCalled();
  });

  it('does nothing when the user cancels', () => {
    window.confirm = () => false;
    deleteWorkoutSession(buttonFor('session_1'));
    expect(getHistory()).toHaveLength(2);
    expect(tombstones()).toEqual([]);
    expect(pushToCloud).not.toHaveBeenCalled();
  });
});
