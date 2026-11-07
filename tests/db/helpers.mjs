// Test helpers: a fresh Postgres database per test file with the demo data loaded.
// Uses DATABASE_URL (defaults to a local server on port 54329; CI starts one on 5432).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const base = process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54329/postgres';
const SQL = fs.readFileSync(path.join(root, 'src/backend/generated/local.sql'), 'utf8');

export async function freshDb() {
  const name = 't_' + Math.random().toString(36).slice(2, 10);
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(base); url.pathname = '/' + name;
  const c = new pg.Client({ connectionString: url.toString() });
  await c.connect();
  c.on('notice', () => {});
  await c.query(SQL);
  await c.query('select app.seed_demo()');
  const ids = {};
  for (const k of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 'a1', 'a2', 'a3', 'admin',
                   'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h1r1', 'h1r2', 'h1r3', 'h2r3', 'h5r1', 'h5r2', 'h8r1', 'h8r2', 'i1', 'b1']) {
    ids[k] = (await c.query('select app.sid($1) as id', [k])).rows[0].id;
  }
  const db = {
    c, ids,
    async as(who) { await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who ? ids[who] || who : '']); return db; },
    async call(fn, args = {}) { const r = await c.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(args)]); return r.rows[0].r; },
    async state() { return (await c.query('select public.get_state() as r')).rows[0].r; },
    async one(sql, params = []) { return (await c.query(sql, params)).rows[0]; },
    async q(sql, params = []) { return (await c.query(sql, params)).rows; },
    // move the demo clock forward by ms and run the scheduled jobs
    async advance(ms) { await c.query('update app.settings set shift_ms = shift_ms + $1', [Math.round(ms)]); return (await c.query('select app.run_jobs() as n')).rows[0].n; },
    async jobs() { return (await c.query('select app.run_jobs() as n')).rows[0].n; },
    async fails(fn, args, re) {
      try { await db.call(fn, args); } catch (e) { if (re && !re.test(e.message)) throw new Error(`${fn} failed with "${e.message}", expected ${re}`); return e.message; }
      throw new Error(`${fn} should have failed`);
    },
    async end() { await c.end(); const a = new pg.Client({ connectionString: base }); await a.connect(); await a.query(`drop database ${name} with (force)`); await a.end(); }
  };
  return db;
}

export const DAY = 864e5, HOUR = 36e5;

// Next valid visit slot for a house (as the client computes it), in ms.
export async function nextSlot(db, houseKey) {
  const r = await db.one(`
    select app.ms(((d::date + t::time) - interval '1 hour') at time zone 'UTC') as ms
    from app.houses h, generate_series(1, 14) n,
         lateral (select (app.wat(app.now()))::date + n as d) dd, unnest(h.times) t
    where h.id = $1 and extract(dow from d)::int = any (h.days)
    order by 1 limit 1`, [db.ids[houseKey] || houseKey]);
  return Number(r.ms);
}
