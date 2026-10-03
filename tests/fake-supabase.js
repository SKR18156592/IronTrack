// In-memory stand-in for the parts of supabase-js the sync engine uses: one user_sync row and the
// workout_sessions table.
export function createFakeSupabase() {
  const server = {
    row: null,
    offline: false,
    writes: 0,
    beforeUpdate: null, // async hook run before an update is applied (simulates a concurrent writer)
    sessions: new Map(), // workout_sessions rows by id
    uploaded: [], // ids of every workout_sessions row upserted, in order
    sessionReads: [], // the updated_at lower bound of each workout_sessions read (null: full read)
    clock: Date.parse('2026-01-01T00:00:00Z')
  };
  // Server-side updated_at, like the workout_sessions trigger: always moves forward.
  const serverNow = () => pgTime(new Date((server.clock += 1000)).toISOString());
  // Stores a session row as another device would have written it.
  server.putSession = row =>
    server.sessions.set(row.id, { deleted: false, data: null, ...structuredClone(row), updated_at: serverNow() });
  const pgTime = iso => new Date(iso).toISOString().replace('Z', '+00:00');
  const matches = filters =>
    filters.every(([op, col, val]) => {
      if (op === 'is') return server.row[col] === val;
      if (col === 'updated_at') return Date.parse(server.row[col]) === Date.parse(val);
      return server.row[col] === val;
    });

  async function runSessions(q) {
    if (q.op === 'upsert') {
      q.payload.forEach(row => server.putSession(row));
      server.uploaded.push(...q.payload.map(row => row.id));
      return { data: null, error: null };
    }
    const since = q.filters.find(([op]) => op === 'gt');
    server.sessionReads.push(since ? since[2] : null);
    const rows = [...server.sessions.values()]
      .filter(r => !since || Date.parse(r.updated_at) > Date.parse(since[2]))
      .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || a.id.localeCompare(b.id));
    const page = q.window ? rows.slice(q.window[0], q.window[1] + 1) : rows;
    return { data: structuredClone(page), error: null };
  }

  async function run(q) {
    if (server.offline) return { data: null, error: { message: 'Failed to fetch' } };
    if (q.table === 'workout_sessions') return runSessions(q);
    if (q.op === 'select') {
      const hit = server.row && matches(q.filters) ? structuredClone(server.row) : null;
      return { data: q.single ? hit : hit ? [hit] : [], error: null };
    }
    if (q.op === 'insert') {
      if (server.row) return { data: null, error: { code: '23505', message: 'duplicate key' } };
      server.row = { ...structuredClone(q.payload), updated_at: pgTime(q.payload.updated_at) };
      server.writes++;
      return { data: null, error: null };
    }
    if (q.op === 'update') {
      if (server.beforeUpdate) {
        const hook = server.beforeUpdate;
        server.beforeUpdate = null;
        await hook();
      }
      if (!server.row || !matches(q.filters)) return { data: [], error: null };
      server.row = { ...server.row, ...structuredClone(q.payload), updated_at: pgTime(q.payload.updated_at) };
      server.writes++;
      return { data: [{ user_id: server.row.user_id }], error: null };
    }
    return { data: null, error: { message: 'unsupported ' + q.op } };
  }

  class Query {
    constructor(table) {
      this.table = table;
      this.op = null;
      this.filters = [];
      this.single = false;
      this.window = null;
    }
    select() {
      if (!this.op) this.op = 'select';
      return this;
    }
    insert(payload) {
      this.op = 'insert';
      this.payload = payload;
      return this;
    }
    update(payload) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    upsert(payload) {
      this.op = 'upsert';
      this.payload = payload;
      return this;
    }
    gt(col, val) {
      this.filters.push(['gt', col, val]);
      return this;
    }
    order() {
      return this;
    } // runSessions always sorts by updated_at, id
    range(from, to) {
      this.window = [from, to];
      return this;
    }
    eq(col, val) {
      this.filters.push(['eq', col, val]);
      return this;
    }
    is(col, val) {
      this.filters.push(['is', col, val]);
      return this;
    }
    maybeSingle() {
      this.single = true;
      return this;
    }
    then(resolve, reject) {
      return run(this).then(resolve, reject);
    }
  }

  const client = { from: table => new Query(table) };
  return { client, server, pgTime };
}
