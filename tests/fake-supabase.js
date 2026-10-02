// In-memory stand-in for the parts of supabase-js the sync engine uses, backed by one user_sync row.
export function createFakeSupabase() {
  const server = {
    row: null,
    offline: false,
    writes: 0,
    beforeUpdate: null, // async hook run before an update is applied (simulates a concurrent writer)
  };
  const pgTime = (iso) => new Date(iso).toISOString().replace('Z', '+00:00');
  const matches = (filters) => filters.every(([op, col, val]) => {
    if (op === 'is') return server.row[col] === val;
    if (col === 'updated_at') return Date.parse(server.row[col]) === Date.parse(val);
    return server.row[col] === val;
  });

  async function run(q) {
    if (server.offline) return { data: null, error: { message: 'Failed to fetch' } };
    if (q.op === 'select') {
      const hit = server.row && matches(q.filters) ? structuredClone(server.row) : null;
      return { data: q.single ? hit : (hit ? [hit] : []), error: null };
    }
    if (q.op === 'insert') {
      if (server.row) return { data: null, error: { code: '23505', message: 'duplicate key' } };
      server.row = { ...structuredClone(q.payload), updated_at: pgTime(q.payload.updated_at) };
      server.writes++;
      return { data: null, error: null };
    }
    if (q.op === 'update') {
      if (server.beforeUpdate) { const hook = server.beforeUpdate; server.beforeUpdate = null; await hook(); }
      if (!server.row || !matches(q.filters)) return { data: [], error: null };
      server.row = { ...server.row, ...structuredClone(q.payload), updated_at: pgTime(q.payload.updated_at) };
      server.writes++;
      return { data: [{ user_id: server.row.user_id }], error: null };
    }
    return { data: null, error: { message: 'unsupported ' + q.op } };
  }

  class Query {
    constructor() { this.op = null; this.filters = []; this.single = false; }
    select() { if (!this.op) this.op = 'select'; return this; }
    insert(payload) { this.op = 'insert'; this.payload = payload; return this; }
    update(payload) { this.op = 'update'; this.payload = payload; return this; }
    eq(col, val) { this.filters.push(['eq', col, val]); return this; }
    is(col, val) { this.filters.push(['is', col, val]); return this; }
    maybeSingle() { this.single = true; return this; }
    then(resolve, reject) { return run(this).then(resolve, reject); }
  }

  const client = { from: () => new Query() };
  return { client, server, pgTime };
}
