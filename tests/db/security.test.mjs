// Regression tests for the security review findings. Production settings (demo off).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { freshDb, nextSlot, DAY, HOUR } from './helpers.mjs';

let db;
before(async () => { db = await freshDb(); await db.c.query('update app.settings set demo = false'); });
after(async () => { await db?.end(); });

async function inspected(student, house) {
  await db.c.query(`insert into app.inspections(house_id, student_id, slot, fee, status, code) values ($1, $2, now() - interval '1 day', 3000, 'completed', '1')`, [db.ids[house], db.ids[student]]);
}
const bal = async s => (await db.one('select app.savings_balance($1) b', [db.ids[s]])).b;

test('savings cannot be spent twice by a withdrawal racing a payment', async () => {
  const { ids } = db;
  await inspected('s1', 'h5');
  await db.as('s1');
  const total = await bal('s1');
  const co = await db.call('start_checkout', { kind: 'rent', houseId: ids.h5, roomId: ids.h5r1, useSav: true });
  // second connection withdraws everything inside an open transaction
  const url = new URL(process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54329/postgres'); url.pathname = '/' + db.c.database;
  const c2 = new pg.Client({ connectionString: url.toString() }); await c2.connect();
  await c2.query(`select set_config('request.jwt.claim.sub', $1, false)`, [ids.s1]);
  await c2.query('begin');
  await c2.query(`select public.withdraw_savings($1::jsonb)`, [JSON.stringify({ amount: total })]);
  const pay = db.call('simulate_pay', { ref: co.ref });       // waits for the student lock
  await new Promise(r => setTimeout(r, 300));
  await c2.query('commit'); await c2.end();
  const res = await pay;
  assert.ok(res.error, 'payment refused after the savings were withdrawn');
  assert.ok((await bal('s1')) >= 0, 'balance never goes negative');
});

test('a tenant cannot open a second ballot after the draw', async () => {
  const { ids } = db;
  await db.as('admin'); await db.call('run_draw', { id: ids.b1 });
  await db.as('s9');
  const k = await db.one(`select code from app.keys where student_id = $1 and status = 'active'`, [ids.s9]);
  await db.fails('not_renewing', { code: k.code }, /already been drawn/);
});

test('ballot payment is refused when the room has no space for the term', async () => {
  const { ids } = db;
  const b = await db.one('select * from app.ballots where id = $1', [ids.b1]);
  const winner = b.draw_order[b.offer_idx];
  await db.c.query(`insert into app.inspections(house_id, student_id, slot, fee, status, code) values ($1, $2, now() - interval '1 day', 3000, 'completed', '1')`, [ids.h8, winner]);
  // someone else already holds a key for the same future period (cap 1)
  await db.c.query(`insert into app.keys(code, house_id, room_id, student_id, start_at, end_at) values ('X-1', $1, $2, $3, app.now() + interval '50 days', app.now() + interval '400 days')`, [ids.h8, ids.h8r1, ids.s12]);
  await db.as(winner);
  const co = await db.call('start_checkout', { kind: 'rent', houseId: ids.h8, roomId: ids.h8r1, ballotId: ids.b1 });
  const r = await db.call('simulate_pay', { ref: co.ref });
  assert.match(r.error, /no longer yours/);
  await db.c.query(`delete from app.keys where code = 'X-1'`);
});

test('visit codes lock after 5 wrong tries', async () => {
  const { ids } = db;
  await db.as('s2');
  const co = await db.call('start_checkout', { kind: 'inspection', houseId: ids.h6, slot: await nextSlot(db, 'h6') });
  const { inspectionId } = await db.call('simulate_pay', { ref: co.ref });
  const code = (await db.one('select code from app.inspections where id = $1', [inspectionId])).code;
  const bad = code === '9999' ? '9998' : '9999';
  for (let i = 0; i < 5; i++) await db.call('confirm_visit', { id: inspectionId, code: bad });
  await db.fails('confirm_visit', { id: inspectionId, code }, /Too many wrong codes/);
});

test('a student can hold the same room at most 3 times a day', async () => {
  const { ids } = db;
  await inspected('s3', 'h1');
  await db.as('s3');
  for (let i = 0; i < 3; i++) { await db.call('hold_room', { roomId: ids.h1r3 }); await db.call('release_room', { roomId: ids.h1r3 }); }
  await db.fails('hold_room', { roomId: ids.h1r3 }, /3 times today/);
});

test('a Paystack charge that arrives after the checkout expired is still applied', async () => {
  await db.c.query(`update app.settings set payment_mode = 'paystack'`);
  await db.as('s5');
  const co = await db.call('start_checkout', { kind: 'deposit', amount: 7000 });
  await db.call('cancel_checkout', { ref: co.ref });
  const r = (await db.one('select public.payment_confirmed($1, $2, $3, $4) r', [co.ref, 700000, 'T9', 'ussd'])).r;
  assert.equal(r.ref, co.ref);
  assert.equal((await db.one('select status from app.payments where ref = $1', [co.ref])).status, 'paid');
  // and simulated payments are refused while Paystack is on
  await db.c.query(`update app.payments set provider = 'simulated' where ref = $1`, [co.ref]);
  const co2 = await db.call('start_checkout', { kind: 'deposit', amount: 7000 });
  await db.c.query(`update app.payments set provider = 'simulated' where ref = $1`, [co2.ref]);
  await db.fails('simulate_pay', { ref: co2.ref }, /goes through Paystack/);
  await db.c.query(`update app.settings set payment_mode = 'simulated'`);
});

test('refunding a failed payment does not hand back savings that were never taken', async () => {
  const { ids } = db;
  await db.c.query(`insert into app.payments(kind, student_id, house_id, room_id, amount, savings_used, ref, status) values ('rent', $1, $2, $3, 300000, 100000, 'PAY-FAILED1', 'failed')`, [ids.s7, ids.h1, ids.h1r1]);
  const before_ = await bal('s7');
  await db.as('admin');
  await db.call('refund_payment', { id: (await db.one(`select id from app.payments where ref = 'PAY-FAILED1'`)).id });
  assert.equal(await bal('s7'), before_);
});

test('hidden listings stay hidden', async () => {
  const { ids } = db;
  await db.as('s4');
  await db.fails('toggle_fav', { houseId: ids.h7 }, /no longer listed/);
  await db.fails('open_thread', { houseId: ids.h7 }, /not taking messages/);
  await db.fails('post_complaint', { houseId: ids.h1, text: 'x' }, /Only people who rented/);
  const st = await db.state();
  assert.ok(!st.houses.some(h => h.id === ids.h7));
});

test('public complaints do not expose student ids or full names', async () => {
  await db.as(null);
  const st = await db.state();
  const c3 = st.complaints.find(c => c.about === 'tenant');
  assert.equal(c3.tenantId, undefined);
  assert.equal(c3.tenantName, 'Tobi O.');
  assert.ok(st.complaints.every(c => c.authorId === undefined || c.authorRole === 'owner'));
});

test('profile email cannot be changed; restore only works for suspended agents', async () => {
  await db.as('s3');
  await db.fails('save_profile', { email: 'owner@example.com' }, /Contact support/);
  await db.as('admin');
  await db.fails('restore_user', { k: 'agent', id: db.ids.a3 }, /Only suspended agents/);
});

test('changing a live listing\'s name sends it back for review; price changes do not', async () => {
  const { ids } = db;
  await db.as('a1');
  const h = await db.one('select * from app.houses where id = $1', [ids.h5]);
  const base = { editId: ids.h5, title: h.title, area: h.area, address: h.address, type: h.type, times: h.times, days: h.days, photos: h.photos,
    rooms: [{ id: ids.h5r1, name: 'Self-contain 1', price: 290000 }, { id: ids.h5r2, name: 'Self-contain 2', price: 280000 }] };
  assert.equal((await db.call('save_listing', base)).mod, 'live');
  assert.equal((await db.call('save_listing', { ...base, title: 'Totally Different Place' })).mod, 'pending');
});

test('go_live clears test money and turns on Paystack', async () => {
  const r = (await db.one('select app.go_live() r')).r;
  assert.match(r, /Paystack is on/);
  const c = await db.one(`select (select count(*) from app.payments)::int p, (select count(*) from app.keys)::int k, (select payment_mode from app.settings) m`);
  assert.deepEqual([c.p, c.k, c.m], [0, 0, 'paystack']);
});
