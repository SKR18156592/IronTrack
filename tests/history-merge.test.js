import { describe, expect, it } from 'vitest';
import { mergeHistories, sessionKey } from '../src/history-merge.js';

const s = (ms, extra = {}) => ({ id: 'session_' + ms, date: '2026-01-01', ...extra });

describe('mergeHistories', () => {
  it('keeps sessions from both sides, newest first', () => {
    const r = mergeHistories({ localHistory: [s(3), s(1)], cloudHistory: [s(2), s(1)] });
    expect(r.merged.map(sessionKey)).toEqual(['session_3', 'session_2', 'session_1']);
    expect(r.localChanged).toBe(true);     // gained session_2
    expect(r.missingFromCloud).toBe(true); // cloud lacks session_3
  });

  it('prefers the local copy of a duplicate session', () => {
    const r = mergeHistories({ localHistory: [s(1, { notes: 'local' })], cloudHistory: [s(1, { notes: 'cloud' })] });
    expect(r.merged).toEqual([s(1, { notes: 'local' })]);
    expect(r.localChanged).toBe(false);
    expect(r.missingFromCloud).toBe(false);
  });

  it('drops sessions tombstoned on either side and unions the tombstones', () => {
    const r = mergeHistories({
      localHistory: [s(1), s(2)], cloudHistory: [s(2), s(3)],
      localTombstones: ['session_1'], cloudTombstones: ['session_3']
    });
    expect(r.merged.map(sessionKey)).toEqual(['session_2']);
    expect(r.tombstones.sort()).toEqual(['session_1', 'session_3']);
    expect(r.missingFromCloud).toBe(true); // cloud lacks the session_1 tombstone
  });

  it('reports a local change when a tombstone removes a local session', () => {
    const r = mergeHistories({ localHistory: [s(1)], cloudHistory: [], cloudTombstones: ['session_1'] });
    expect(r.merged).toEqual([]);
    expect(r.localChanged).toBe(true);
    expect(r.missingFromCloud).toBe(false);
  });

  it('handles legacy records without ids by content, ordered by date', () => {
    const legacy = { date: '2025-06-01', day: '1' };
    const r = mergeHistories({ localHistory: [legacy], cloudHistory: [{ ...legacy }, s(Date.parse('2026-01-01'))] });
    expect(r.merged).toHaveLength(2);
    expect(r.merged[1]).toEqual(legacy);
  });

  it('is a no-op when both sides match', () => {
    const r = mergeHistories({ localHistory: [s(2), s(1)], cloudHistory: [s(2), s(1)] });
    expect(r.localChanged).toBe(false);
    expect(r.missingFromCloud).toBe(false);
  });
});
