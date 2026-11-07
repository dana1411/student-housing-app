import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, nextSlot, DAY, HOUR } from './helpers.mjs';

let db;
before(async () => { db = await freshDb(); });
after(async () => { await db?.end(); });

async function inspect(student, house) {
  await db.as(student);
  const co = await db.call('start_checkout', { kind: 'inspection', houseId: db.ids[house], slot: await nextSlot(db, house) });
  const { inspectionId } = await db.call('simulate_pay', { ref: co.ref });
  const code = (await db.one('select code from app.inspections where id = $1', [inspectionId])).code;
  await db.call('confirm_visit', { id: inspectionId, code });
  return inspectionId;
}

test('ballot: join, draw, winner pays, room passes to the winner when the key ends', async () => {
  const { ids } = db;
  // b1 is the seeded open ballot for Modomo Court, Self-contain 1; draw in 2 days
  await db.as('s1');
  await db.fails('join_ballot', { id: ids.b1 }, /Inspect the house first/);
  await inspect('s1', 'h8');
  await db.call('join_ballot', { id: ids.b1 });
  let st = await db.state();
  const b = st.ballots.find(x => x.id === ids.b1);
  assert.ok(b.entrants.includes(ids.s1));
  assert.ok(b.entrants.filter(x => x !== ids.s1).every(x => /^x\d+$/.test(x)), 'other entrants anonymised');

  // make s1 the only eligible entrant, then let the draw date pass
  await db.c.query('delete from app.ballot_entries where ballot_id = $1 and student_id <> $2', [ids.b1, ids.s1]);
  await db.advance(2 * DAY + HOUR);
  st = await db.state();
  const drawn = st.ballots.find(x => x.id === ids.b1);
  assert.equal(drawn.status, 'drawn');
  assert.deepEqual(drawn.order, [ids.s1]);
  const room = st.houses.find(h => h.id === ids.h8).rooms.find(r => r.id === ids.h8r1);
  assert.equal(room.hold, ids.b1);

  // the winner pays; the new key starts when the current tenant's key ends
  const co = await db.call('start_checkout', { kind: 'rent', houseId: ids.h8, roomId: ids.h8r1, ballotId: ids.b1 });
  const res = await db.call('simulate_pay', { ref: co.ref });
  st = await db.state();
  const mine = st.keys.find(k => k.code === res.key);
  const current = st.keys.find(k => k.roomId === ids.h8r1 && k.code !== res.key);
  assert.ok(mine.start >= current.end - 1000, 'starts when the room frees up');
  assert.equal(st.ballots.find(x => x.id === ids.b1).status, 'filled');

  // fast forward past the current tenant's end date
  await db.advance(50 * DAY);
  const k9 = await db.one('select status from app.keys where id = $1', [current.id]);
  assert.equal(k9.status, 'expired');
  assert.equal((await db.one('select app.active_count($1) n', [ids.h8r1])).n, 1);
  await db.c.query('update app.settings set shift_ms = 0');
});

test('ballot offer passes to the next person after 48 hours', async () => {
  const { ids } = db;
  await db.c.query('update app.settings set demo = false');  // no simulated sample winners
  // a fresh ballot on Gold House Annex B (seeded key for s2, ends in 240 days)
  await inspect('s3', 'h1');
  await inspect('s4', 'h1');
  const key = await db.one(`select id from app.keys where room_id = $1 and status = 'active'`, [ids.h1r2]);
  const b = await db.one(`select (app.open_ballot($1, app.now() + interval '1 hour')).id as id`, [key.id]);
  await db.c.query('delete from app.ballot_entries where ballot_id = $1', [b.id]);
  await db.as('s3'); await db.call('join_ballot', { id: b.id });
  await db.as('s4'); await db.call('join_ballot', { id: b.id });
  await db.advance(2 * HOUR);
  const d = await db.one('select * from app.ballots where id = $1', [b.id]);
  assert.equal(d.status, 'drawn');
  const first = d.draw_order[0], second = d.draw_order[1];
  await db.advance(49 * HOUR);
  const d2 = await db.one('select * from app.ballots where id = $1', [b.id]);
  assert.equal(d2.offer_idx, 1);
  // the first winner can no longer pay
  await db.as(first);
  await db.fails('start_checkout', { kind: 'rent', houseId: ids.h1, roomId: ids.h1r2, ballotId: b.id }, /no longer yours/);
  await db.as(second);
  const co = await db.call('start_checkout', { kind: 'rent', houseId: ids.h1, roomId: ids.h1r2, ballotId: b.id });
  assert.ok(co.ref);
  await db.call('cancel_checkout', { ref: co.ref });
  await db.c.query('update app.settings set shift_ms = 0, demo = true');
});

test('renewal before the draw cancels the ballot', async () => {
  const { ids } = db;
  await db.as('s10');
  const k = await db.one(`select code, end_at from app.keys where student_id = $1 and status = 'active'`, [ids.s10]);
  await db.call('not_renewing', { code: k.code });
  let b = await db.one(`select b.* from app.ballots b join app.keys k on k.id = b.key_id where k.code = $1`, [k.code]);
  assert.equal(b.status, 'open');
  const co = await db.call('start_checkout', { kind: 'renewal', keyCode: k.code });
  await db.call('simulate_pay', { ref: co.ref });
  b = await db.one('select status from app.ballots where id = $1', [b.id]);
  assert.equal(b.status, 'cancelled');
  const k2 = await db.one('select end_at, renewals from app.keys where code = $1', [k.code]);
  assert.equal(k2.renewals, 1);
  assert.equal((k2.end_at - k.end_at) / DAY, 360);
});

test('agent creates a listing, admin approves, students see it', async () => {
  const { ids } = db;
  await db.as('a1');
  await db.fails('save_listing', { title: 'X', address: 'Y', times: [], days: [1], rooms: [{ name: 'A', price: 1000 }] }, /one day and one time/);
  const r = await db.call('save_listing', {
    title: 'Test Lodge', area: 'Damico', address: '1 Test Rd, Ile-Ife', km: 1.5, type: 'Single room', desc: 'Nice',
    amenities: ['Borehole water'], rules: ['No smoking'], shared: true, photos: [], times: ['10:00', '15:00'], days: [1, 3, 5],
    baths: 2, rooms: [{ name: 'Room 1', price: '150,000', cap: 2 }, { name: 'Room 2', price: 140000 }, { name: '', price: 5 }]
  });
  assert.equal(r.mod, 'pending');
  await db.as('s1');
  let st = await db.state();
  assert.ok(!st.houses.some(h => h.id === r.id), 'pending listing hidden from students');
  await db.as('admin');
  await db.call('approve_listing', { id: r.id });
  await db.as('s1');
  st = await db.state();
  const h = st.houses.find(x => x.id === r.id);
  assert.equal(h.rooms.length, 2);
  assert.equal(h.rooms[0].cap, 2);
  assert.equal(h.rooms[0].price, 150000);

  // edit: rename a room, drop the other one (no tenants, so it is archived)
  await db.as('a1');
  await db.call('save_listing', { editId: r.id, title: 'Test Lodge 2', area: 'Damico', address: '1 Test Rd, Ile-Ife', type: 'Single room',
    times: ['10:00'], days: [1], shared: true, rooms: [{ id: h.rooms[0].id, name: 'Room One', price: 155000, cap: 3 }] });
  st = await db.state();
  const h2 = st.houses.find(x => x.id === r.id);
  assert.equal(h2.title, 'Test Lodge 2');
  assert.deepEqual(h2.rooms.map(x => [x.name, x.price, x.cap]), [['Room One', 155000, 3]]);

  // pause, can't delete with a booked visit, then delete
  await db.as('s5');
  const co = await db.call('start_checkout', { kind: 'inspection', houseId: r.id, slot: await nextSlot(db, r.id) });
  const { inspectionId } = await db.call('simulate_pay', { ref: co.ref });
  await db.as('a1');
  await db.fails('delete_listing', { id: r.id }, /booked visits/);
  await db.call('agent_cancel_visit', { id: inspectionId });
  assert.equal((await db.one('select status from app.payments where ref = $1', [co.ref])).status, 'refunded');
  await db.call('delete_listing', { id: r.id });
  await db.as('s1');
  st = await db.state();
  assert.ok(!st.houses.some(x => x.id === r.id));
});

test('other agents cannot touch someone else\'s listing', async () => {
  await db.as('a2');
  await db.fails('toggle_listing_pause', { id: db.ids.h1 }, /not found/);
  await db.fails('approve_listing', { id: db.ids.h7 }, /Only admins/);
});

test('admin: take down cancels and refunds visits; suspend agent hides houses', async () => {
  const { ids } = db;
  // i1 is s7's booked visit at Parakin Quarters (agent a1)
  await db.as('admin');
  const r = await db.call('take_down_listing', { id: ids.h5, reason: 'Duplicate of another listing' });
  assert.equal(r.visits, 1);
  assert.equal((await db.one('select status from app.inspections where id = $1', [ids.i1])).status, 'cancelled');
  await db.call('restore_listing', { id: ids.h5 });
  await db.call('suspend_user', { k: 'agent', id: ids.a2, reason: 'Repeated no-shows' });
  await db.as(null);
  let st = await db.state();
  assert.ok(!st.houses.some(h => h.agentId === ids.a2));
  await db.as('admin');
  await db.call('restore_user', { k: 'agent', id: ids.a2 });
  await db.call('approve_agent', { id: ids.a3 });
  await db.as(null);
  st = await db.state();
  assert.ok(st.agents[ids.a3]);
});

test('chat: flagged messages, report and block', async () => {
  const { ids } = db;
  await db.as('s1');
  const { id } = await db.call('open_thread', { houseId: ids.h3 });
  const m = await db.call('send_message', { id, text: 'Can I send the money to your account number 0123456789?' });
  assert.equal(m.flag, true);
  await db.as('a2');
  await db.call('send_message', { id, text: 'Please pay in the app.' });
  await db.call('report_thread', { id, reason: 'Asked to pay outside', block: true });
  await db.as('s1');
  await db.fails('send_message', { id, text: 'hello' }, /blocked/);
  await db.as('s2');
  await db.fails('send_message', { id, text: 'hello' }, /not found/);
  await db.as('admin');
  const st = await db.state();
  assert.ok(st.threads.find(t => t.id === id).reported);
  assert.ok(st.notes.some(n => n.to === 'admin' && /flagged/.test(n.text)));
});

test('scheduled jobs: reminders, holds expire, rent auto-released after 7 days', async () => {
  const { ids } = db;
  // s4 paid rent 5 days ago (held). After 7 days it is released.
  await db.advance(3 * DAY);
  const p = await db.one(`select status from app.payments where id = app.sid('p3')`);
  assert.equal(p.status, 'released');
  await db.c.query('update app.settings set shift_ms = 0');
  await db.jobs();
});
