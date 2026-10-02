// Workout history is merged by session id, never overwritten, so two devices logging sessions
// while out of sync both keep their sessions. Deleted sessions are kept as tombstones (their keys).

export function sessionKey(rec) { return (rec && rec.id) ? String(rec.id) : JSON.stringify(rec); }

export function sessionTime(rec) {
  const m = /^session_(\d+)$/.exec((rec && rec.id) || '');
  return m ? Number(m[1]) : (Date.parse(rec && rec.date) || 0);
}

// Pure: merges two histories (newest first), dropping tombstoned sessions. On a duplicate key the
// local record wins. Reports whether the local copy changed and whether the cloud is missing anything.
export function mergeHistories({ localHistory = [], cloudHistory = [], localTombstones = [], cloudTombstones = [] }) {
  const tombstones = [...new Set([...localTombstones, ...cloudTombstones])];
  const deleted = new Set(tombstones);

  const byKey = new Map();
  [...localHistory, ...cloudHistory].forEach(rec => {
    const k = sessionKey(rec);
    if (!deleted.has(k) && !byKey.has(k)) byKey.set(k, rec);
  });
  const merged = [...byKey.values()].sort((a, b) => sessionTime(b) - sessionTime(a));

  const localKeys = new Set(localHistory.map(sessionKey));
  const cloudKeys = new Set(cloudHistory.map(sessionKey));
  return {
    merged,
    tombstones,
    localChanged: merged.length !== localHistory.length || merged.some(rec => !localKeys.has(sessionKey(rec))),
    missingFromCloud: merged.some(rec => !cloudKeys.has(sessionKey(rec))) || tombstones.length !== new Set(cloudTombstones).size
  };
}
