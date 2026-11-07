import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, nextSlot, DAY, HOUR } from './helpers.mjs';

let db;
before(async () => { db = await freshDb(); });
after(async () => { await db?.end(); });

test('anonymous visitors see public listings but no private data', async () => {
  await db.as(null);
  const s = await db.state();
  assert.equal(s.me, null);
  assert.ok(s.houses.length >= 6, 'live houses visible');
  assert.ok(!s.houses.some(h => h.mod === 'pending'), 'pending listing hidden');
  assert.equal(s.payments.length, 0);
  assert.equal(s.inspections.length, 0);
  assert.ok(s.keys.every(k => k.hidden && k.code.startsWith('K-') && !k.studentId), 'other people\'s keys are redacted');
  assert.equal(Object.keys(s.students).length, 0);
  assert.ok(Object.values(s.agents).every(a => a.phone === undefined), 'agent phones hidden');
});

test('inspection → visit code → rent → key → move-in releases rent', async () => {
  const { ids } = db;
  await db.as('s1');
  // rent is locked before an inspection
  await db.fails('hold_room', { roomId: ids.h1r1 }, /inspection first/);

  const slot = await nextSlot(db, 'h1');
  await db.fails('start_checkout', { kind: 'inspection', houseId: ids.h1, slot: slot + 60e3 }, /no longer available/);
  const co = await db.call('start_checkout', { kind: 'inspection', houseId: ids.h1, slot, method: 'OPay' });
  assert.equal(co.amount, 3000);
  assert.equal(co.mode, 'simulated');
  const res = await db.call('simulate_pay', { ref: co.ref });
  assert.ok(res.inspectionId);
  // paying twice does not book twice
  await db.call('simulate_pay', { ref: co.ref });
  assert.equal((await db.one('select count(*)::int n from app.inspections where student_id = $1 and house_id = $2', [ids.s1, ids.h1])).n, 1);
  await db.fails('start_checkout', { kind: 'inspection', houseId: ids.h1, slot }, /already have a visit/);

  // the agent sees the code; demo mode also shows it to the student
  await db.as('a1');
  let st = await db.state();
  const ins = st.inspections.find(i => i.id === res.inspectionId);
  assert.match(ins.code, /^\d{4}$/);
  assert.ok(st.threads.some(t => t.houseId === ids.h1 && t.studentId === ids.s1), 'chat opened with a confirmation');

  await db.as('s1');
  const wrong = await db.call('confirm_visit', { id: ins.id, code: '0000' === ins.code ? '1111' : '0000' });
  assert.match(wrong.error, /does not match/);
  await db.call('confirm_visit', { id: ins.id, code: ins.code });
  const rated = await db.call('rate_visit', { id: ins.id, n: 5 });
  assert.equal(rated.ratings, 24);

  // hold the room, another student cannot take it meanwhile
  const hold = await db.call('hold_room', { roomId: ids.h1r1 });
  assert.ok(hold.until > Date.now());
  await db.as('s2');
  await db.c.query(`insert into app.inspections(house_id, student_id, slot, fee, status, code) values ($1, $2, now() - interval '1 day', 3000, 'completed', '1234')`, [ids.h1, ids.s2]);
  await db.fails('hold_room', { roomId: ids.h1r1 }, /paying for this room/);
  st = await db.state();
  const r1 = st.houses.find(h => h.id === ids.h1).rooms.find(r => r.id === ids.h1r1);
  assert.equal(r1.payHold.by, 'other');

  // pay rent using part savings
  await db.as('s1');
  const bal0 = (await db.one('select app.savings_balance($1) b', [ids.s1])).b;
  const rc = await db.call('start_checkout', { kind: 'rent', houseId: ids.h1, roomId: ids.h1r1, useSav: true, method: 'Bank transfer' });
  assert.equal(rc.amount, 320000);
  assert.equal(rc.charge, 320000 - bal0);
  const rr = await db.call('simulate_pay', { ref: rc.ref });
  assert.match(rr.key, /^LDG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal((await db.one('select app.savings_balance($1) b', [ids.s1])).b, 0);

  st = await db.state();
  const key = st.keys.find(k => k.code === rr.key);
  assert.equal(key.studentId, ids.s1);
  const pay = st.payments.find(p => p.ref === rc.ref);
  assert.equal(pay.status, 'held');
  assert.equal(st.houses.find(h => h.id === ids.h1).rooms.find(r => r.id === ids.h1r1).occ[0], rr.key);

  // other students can't see the code
  await db.as('s2');
  st = await db.state();
  assert.ok(!JSON.stringify(st).includes(rr.key), 'key code hidden from others');

  // move-in releases the rent to the agent
  await db.as('s1');
  await db.call('confirm_move_in', { code: rr.key });
  assert.equal((await db.one('select status from app.payments where ref = $1', [rc.ref])).status, 'released');
  await db.as('a1');
  st = await db.state();
  assert.ok(st.notes.some(n => /released to you for Self-contain A/.test(n.text)));
});

test('cancelling a visit early refunds, late keeps the fee', async () => {
  const { ids } = db;
  await db.as('s1');
  const slot = await nextSlot(db, 'h5');
  const co = await db.call('start_checkout', { kind: 'inspection', houseId: ids.h5, slot });
  const { inspectionId } = await db.call('simulate_pay', { ref: co.ref });
  const r = await db.call('cancel_visit', { id: inspectionId });
  // the next slot is at least tomorrow, so usually more than 12 hours away
  const hoursAway = (slot - Number((await db.one('select app.ms(app.now()) t')).t)) / HOUR;
  assert.equal(r.refunded, hoursAway > 12);
  assert.equal((await db.one('select status from app.payments where ref = $1', [co.ref])).status, r.refunded ? 'refunded' : 'paid');
});

test('savings: goal rules, deposits and withdrawals', async () => {
  await db.as('s1');
  const dep = await db.call('start_checkout', { kind: 'deposit', amount: 50000, method: 'OPay' });
  await db.call('simulate_pay', { ref: dep.ref });
  assert.equal((await db.one('select app.savings_balance($1) b', [db.ids.s1])).b, 50000);
  await db.fails('withdraw_savings', { amount: 60000 }, /up to ₦50,000/);
  await db.call('withdraw_savings', { amount: 10000 });
  await db.call('save_goal', { name: 'Rent', target: '400,000', due: '2027-06-01', mode: 'locked', sched: 'weekly', schedAmt: '5000' });
  await db.fails('save_goal', { name: 'Rent', target: '400000', due: '2027-06-01', mode: 'flexible', sched: 'weekly', schedAmt: '5000' }, /locked until/);
  await db.fails('withdraw_savings', { amount: 100 }, /locked until/);
  // auto-save adds weekly deposits in simulated mode
  const before = (await db.one('select app.savings_balance($1) b', [db.ids.s1])).b;
  await db.advance(15 * DAY);
  const after_ = (await db.one('select app.savings_balance($1) b', [db.ids.s1])).b;
  assert.equal(after_ - before, 10000);
  await db.c.query('update app.settings set shift_ms = 0');
});

test('suspended students cannot book or pay, but can still read their data', async () => {
  await db.as('admin');
  await db.call('suspend_user', { k: 'student', id: db.ids.s2, reason: 'Abusive behaviour' });
  await db.as('s2');
  const slot = await nextSlot(db, 'h3');
  await db.fails('start_checkout', { kind: 'inspection', houseId: db.ids.h3, slot }, /suspended/);
  const st = await db.state();
  assert.equal(st.me.suspended, true);
  assert.ok(st.keys.some(k => k.studentId === db.ids.s2 && !k.hidden), 'still sees own key');
  await db.as('admin');
  await db.call('restore_user', { k: 'student', id: db.ids.s2 });
});
