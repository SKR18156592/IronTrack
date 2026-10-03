// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ui.js', async importOriginal => ({ ...(await importOriginal()), showToast: vi.fn() }));

const { exportHistoryCSV } = await import('../src/render/history.js');
const { clearHistory, loadHistory, setHistory } = await import('../src/history-store.js');

// Captures the exported file instead of downloading it.
let exported;
beforeEach(async () => {
  localStorage.clear();
  await loadHistory();
  clearHistory();
  exported = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
    exported = blob;
    return 'blob:test';
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('exportHistoryCSV', () => {
  it("keeps everything after a '#' and exports zeros as 0", async () => {
    setHistory([
      {
        id: 'session_1',
        date: '2026-10-01',
        day: '1',
        dayTitle: 'Push #1',
        exercises: [
          {
            name: 'Dip',
            machineOpt: 'Station #2',
            sets: [{ setNum: 1, weight: 0, reps: 12, tag: 'Working', rir: 0 }]
          }
        ]
      }
    ]);
    exportHistoryCSV();
    const lines = (await exported.text()).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-10-01,1,"Push #1",,,"Dip","Station #2",1,0,12,Working,0');
  });
});
