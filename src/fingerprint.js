// A short id for a version of a JSON value: equal values (whatever their key order) get equal ids.

// Key order is normalized because Postgres jsonb does not keep it.
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return (
      '{' +
      Object.keys(v)
        .sort()
        .filter(k => v[k] !== undefined)
        .map(k => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v ?? null);
}

// FNV-1a hash plus length: identifies a version of a record, not a security measure.
export function fingerprint(rec) {
  const s = canonical(rec);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + '.' + s.length.toString(36);
}
