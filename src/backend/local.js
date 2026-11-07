// Demo mode: the real database code runs inside the browser (PGlite = Postgres
// compiled to WebAssembly), with sample data. Nothing leaves the device.
import { PGlite } from '@electric-sql/pglite';
import SQL from './generated/local.sql?raw';

const DB_NAME = 'lodgely-demo';
const K_HASH = 'lodgely-demo-sql', K_USER = 'lodgely-demo-user';
const FN = /^[a-z_]+$/;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } }
};

async function sha256(s) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'x' + h;
  }
}

function dropIdb(name) {
  return new Promise(res => {
    try { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => res(); }
    catch { res(); }
  });
}

const clean = e => {
  const m = (e && e.message) || String(e);
  return m.replace(/^error:\s*/i, '');
};

export async function create() {
  const version = await sha256(SQL);
  let persistent = true;
  // A new version of the app resets the demo data.
  if (store.get(K_HASH) !== version) await dropIdb('/pglite/' + DB_NAME);
  let db;
  try { db = await PGlite.create('idb://' + DB_NAME); }
  catch { db = await PGlite.create(); persistent = false; }
  const ready = (await db.query(`select to_regclass('app.settings') as t`)).rows[0].t;
  if (!ready) {
    await db.exec(SQL);
    await db.exec('select app.seed_demo()');
    store.set(K_HASH, version);
  }

  let user = store.get(K_USER) || null;
  let queue = Promise.resolve();
  const serial = fn => (queue = queue.then(fn, fn));
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(); } catch { /* ignore */ } });
  const people = (await db.query(`select public.demo_people('{}') as r`)).rows[0].r;

  async function run(sql, params) {
    return serial(async () => {
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user || '']);
      try { return await db.query(sql, params); }
      catch (e) { throw new Error(clean(e)); }
    });
  }
  async function call(fn, args = {}) {
    if (!FN.test(fn)) throw new Error('Unknown action.');
    const r = await run(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(args || {})]);
    return r.rows[0].r;
  }
  function setUser(id) { user = id || null; store.set(K_USER, user); emit(); }

  const B = {
    mode: 'demo',
    persistent,
    people,
    user: () => user,
    async init() {},
    async state() { return (await run('select public.get_state() as r', [])).rows[0].r; },
    call,
    onChange(f) {
      listeners.add(f);
      // the scheduler: in demo mode the app runs the time-based rules itself
      const t = setInterval(async () => {
        try { const r = await call('demo_tick', {}); if (r && r.changed) f(); } catch { /* ignore */ }
      }, 5000);
      return () => { listeners.delete(f); clearInterval(t); };
    },
    auth: {
      // returns {needsCode:true} like the live app; the demo shows the code on screen
      async signUp(d) {
        const r = await call('demo_signup', { ...d, pw: await sha256('pw:' + d.password) });
        B._pending = { id: r.id, code: String(Math.floor(100000 + Math.random() * 900000)) };
        return { needsCode: true, demoCode: B._pending.code };
      },
      async verify({ code }) {
        if (!B._pending || code !== B._pending.code) throw new Error('That code is not right. Check your email or send a new code.');
        setUser(B._pending.id); B._pending = null;
      },
      async resend() { if (B._pending) B._pending.code = String(Math.floor(100000 + Math.random() * 900000)); return { demoCode: B._pending && B._pending.code }; },
      async signIn({ id, password }) { const r = await call('demo_login', { id, pw: await sha256('pw:' + password) }); setUser(r.id); return r; },
      async signInAs(role) { setUser(people[role]); },
      async signOut() { setUser(null); },
      async sendReset({ id }) {
        await call('demo_login', { id, pw: '' }).catch(e => { if (/No account/.test(e.message)) throw e; });
        B._reset = { id, code: String(Math.floor(100000 + Math.random() * 900000)) };
        return { demoCode: B._reset.code };
      },
      async doReset({ code, password }) {
        if (!B._reset || code !== B._reset.code) throw new Error('That code is not right.');
        await call('demo_set_password', { id: B._reset.id, pw: await sha256('pw:' + password) }); B._reset = null;
      },
      async changePassword({ current, next }) {
        const me = (await B.state()).me;
        if (!me) throw new Error('Log in first.');
        if (![people.student, people.agent, people.admin].includes(me.id)) {
          await call('demo_login', { id: me.email, pw: await sha256('pw:' + current) }).catch(() => { throw new Error('Your current password is not right.'); });
        }
        if (me.email) await call('demo_set_password', { id: me.email, pw: await sha256('pw:' + next) });
      }
    },
    // Files stay on the device: images as data URLs, documents by name.
    async upload(file, { kind } = {}) {
      if (kind === 'doc') return file.name;
      return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    },
    async fileUrl(path) { return null; },
    async reset() { store.set(K_HASH, null); store.set(K_USER, null); try { await db.close(); } catch { /* ignore */ } await dropIdb('/pglite/' + DB_NAME); location.reload(); }
  };
  return B;
}
