// Calls every remaining API function at least once (plpgsql only reports many
// mistakes when a function actually runs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, nextSlot, DAY, HOUR } from './helpers.mjs';

let db;
before(async () => { db = await freshDb(); });
after(async () => { await db?.end(); });

async function book(student, house) {
  await db.as(student);
  const co = await db.call('start_checkout', { kind: 'inspection', houseId: db.ids[house], slot: await nextSlot(db, house) });
  return (await db.call('simulate_pay', { ref: co.ref })).inspectionId;
}

test('student extras', async () => {
  const { ids } = db;
  await db.as('s1');
  assert.equal((await db.call('toggle_fav', { houseId: ids.h1 })).saved, true);
  assert.equal((await db.call('toggle_fav', { houseId: ids.h1 })).saved, false);
  const iid = await book('s1', 'h2');
  // reschedule to the following valid slot
  const slots = await db.q(`select app.ms(((d::date + t::time) - interval '1 hour') at time zone 'UTC') as ms
    from app.houses h, generate_series(1, 14) n, lateral (select (app.wat(app.now()))::date + n as d) dd, unnest(h.times) t
    where h.id = $1 and extract(dow from d)::int = any (h.days) order by 1 limit 3`, [ids.h2]);
  const moved = await db.call('reschedule_visit', { id: iid, slot: Number(slots[2].ms) });
  assert.equal(moved.slot, Number(slots[2].ms));
  await db.fails('reschedule_visit', { id: iid, slot: Number(slots[1].ms) }, /move a visit once/);
  // no-show only after the time has passed
  await db.fails('report_no_show', { id: iid }, /once the visit time has passed/);
  await db.advance(4 * DAY);
  await db.as('s1');
  const ns = await db.call('report_no_show', { id: iid });
  assert.ok(ns.trust >= 0);
  await db.c.query('update app.settings set shift_ms = 0');
  // mismatch + public complaint + dispute
  const done = await db.one(`select id from app.inspections where student_id = $1 and status = 'completed' limit 1`, [ids.s4]);
  await db.as('s4');
  await db.call('report_mismatch', { id: done.id, text: 'The kitchen was not there' });
  await db.fails('report_mismatch', { id: done.id, text: 'again' }, /already reported/);
  await db.call('post_complaint', { houseId: ids.h3, about: 'agent', text: 'Slow to reply' });
  const key = await db.one(`select code from app.keys where student_id = $1 and status = 'active'`, [ids.s4]);
  await db.call('raise_dispute', { code: key.code, reason: 'Money or refund', text: 'Room differs' });
  await db.call('toggle_auto_renew', { code: key.code });
  await db.call('leave_ballot', { id: ids.b1 });
  await db.call('mark_notes_read', {});
  // agent replies to the public complaint
  await db.as('a2');
  const c = await db.one(`select id from app.complaints where author_id = $1 and kind = 'public'`, [ids.s4]);
  await db.call('reply_complaint', { id: c.id, text: 'We have improved.' });
  await db.as('s5');
  await db.fails('reply_complaint', { id: c.id, text: 'x' }, /Only the person/);
});

test('agent extras', async () => {
  const { ids } = db;
  await db.as('a1');
  assert.equal((await db.call('toggle_room_pause', { houseId: ids.h1, roomId: ids.h1r3 })).paused, true);
  await db.call('toggle_room_pause', { houseId: ids.h1, roomId: ids.h1r3 });
  assert.equal((await db.call('toggle_shared', { houseId: ids.h1 })).shared, true);
  assert.equal((await db.call('set_room_cap', { houseId: ids.h1, roomId: ids.h1r1, d: 1 })).cap, 2);
  await db.call('toggle_shared', { houseId: ids.h1 });
  assert.equal((await db.one('select cap from app.rooms where id = $1', [ids.h1r1])).cap, 1);
  assert.equal((await db.call('toggle_listing_pause', { id: ids.h5 })).paused, true);
  await db.call('toggle_listing_pause', { id: ids.h5 });
  const k = await db.one(`select code from app.keys where house_id = $1 and status = 'active' limit 1`, [ids.h1]);
  await db.call('post_tenant_complaint', { code: k.code, text: 'Late with bills' });
  assert.match((await db.call('check_payout', { acct: '0123456789' })).name, /KUNLE/);
  await db.call('save_payout', { bank: 'GTBank', acct: '0123456789' });
  await db.call('save_profile', { email: 'k@example.com', bio: 'Hello' });
  await db.call('save_prefs', { prefs: { visits: { email: true, sms: false } } });
  await db.call('set_phone', { phone: '0803 000 1111' });
  await db.call('note_password_changed', {});
  // visits: agent marks done and missed
  const v1 = await book('s11', 'h1');
  const v2 = await book('s12', 'h1');
  await db.as('a1');
  await db.fails('agent_complete_visit', { id: v1 }, /an hour before/);
  await db.fails('mark_missed', { id: v2 }, /time has passed/);
  await db.advance(15 * DAY);
  await db.as('a1');
  await db.call('agent_complete_visit', { id: v1 });
  await db.call('mark_missed', { id: v2 });
  await db.c.query('update app.settings set shift_ms = 0');
  // thread read + agent docs (pending agent a3 resubmits after rejection)
  const th = await db.one(`select id from app.threads where agent_id = $1 limit 1`, [ids.a1]);
  await db.call('mark_thread_read', { id: th.id });
  await db.as('admin');
  await db.call('reject_agent', { id: ids.a3, reason: 'ID unreadable', note: 'Please rescan' });
  await db.as('a3');
  const r = await db.call('submit_agent_docs', { idType: 'NIN slip', idFile: 'nin.jpg', proofType: 'Letter of authority', proofFile: 'letter.pdf' });
  assert.equal(r.resubmitted, true);
  assert.equal((await db.one('select status from app.agents where id = $1', [ids.a3])).status, 'pending');
});

test('admin extras', async () => {
  const { ids } = db;
  await db.as('admin');
  await db.call('reject_listing', { id: ids.h7, note: 'Add photos' });
  const held = await db.one(`select id from app.payments where id = app.sid('p3')`);
  await db.call('release_payment', { id: held.id });
  await db.call('mark_paid_out', { id: held.id });
  const rent = await db.one(`select id from app.payments where id = app.sid('p9')`);
  await db.call('refund_payment', { id: rent.id });
  assert.equal((await db.one(`select status from app.keys where payment_id = $1`, [rent.id])).status, 'cancelled');
  const c = await db.one(`select id from app.complaints where kind = 'dispute' limit 1`);
  await db.call('set_complaint_status', { id: c.id, status: 'resolved', upheld: true });
  assert.equal((await db.call('toggle_complaint_removed', { id: c.id })).removed, true);
  await db.call('run_draw', { id: ids.b1 });
  const b = await db.one('select status from app.ballots where id = $1', [ids.b1]);
  if (b.status === 'drawn') await db.call('pass_offer', { id: ids.b1 });
  await db.call('review_report', { id: (await db.one(`select id from app.threads where reported limit 1`)).id });
});

test('anonymous: support, waitlist; account deletion', async () => {
  await db.as(null);
  await db.fails('contact_support', { name: 'A', contact: 'nope', msg: 'Hello there team' }, /email address or phone/);
  await db.call('contact_support', { name: 'Ada', contact: 'ada@example.com', topic: 'Payments', msg: 'How do refunds work?' });
  await db.call('join_waitlist', { school: 'ui', contact: '0803 123 4567' });
  await db.as('admin');
  const st = await db.state();
  assert.equal(st.support.length, 1);
  assert.equal(st.waitlist.length, 1);
  await db.call('toggle_support_done', { id: st.support[0].id });
  // s12 has nothing pending, so they can delete their account
  await db.as('s6');
  const chk = await db.call('delete_account_check', {});
  assert.deepEqual(chk.busy, []);
  await db.call('delete_account', {});
  assert.equal((await db.one('select deleted, name from app.profiles where id = $1', [db.ids.s6])).name, 'Deleted user');
  // s1 still has savings history but balance; check reports blockers
  await db.as('s4');
  assert.ok((await db.call('delete_account_check', {})).busy.length > 0);
});

test('demo tools and provider hooks', async () => {
  const { ids } = db;
  await db.as('s1');
  const { id } = await db.call('open_thread', { houseId: ids.h6 });
  await db.call('demo_reply', { id, text: 'How is the water?' });
  const last = await db.one('select body from app.messages where thread_id = $1 order by id desc limit 1', [id]);
  assert.match(last.body, /Water is steady/);
  assert.ok((await db.call('demo_tick', {})).changed >= 0);
  const r = await db.call('demo_set_clock', { shift: 3 * DAY });
  assert.equal(Number(r.shift), 3 * DAY);
  await db.call('demo_set_clock', { shift: 0 });
  // provider path: Paystack mode sends a pending payment through payment_confirmed
  await db.c.query(`update app.settings set payment_mode = 'paystack'`);
  const co = await db.call('start_checkout', { kind: 'deposit', amount: 2500 });
  assert.equal(co.mode, 'paystack');
  await db.fails('simulate_pay', { ref: co.ref }, /goes through Paystack/);
  const info = (await db.one('select public.payment_for_provider($1) r', [co.ref])).r;
  assert.equal(Number(info.chargeKobo), 250000);
  const bad = (await db.one('select public.payment_confirmed($1, $2, $3, $4) r', [co.ref, 1000, 'T1', 'card'])).r;
  assert.equal(bad.error, 'amount mismatch');
  const co2 = await db.call('start_checkout', { kind: 'deposit', amount: 2500 });
  const ok = (await db.one('select public.payment_confirmed($1, $2, $3, $4) r', [co2.ref, 250000, 'T2', 'bank_transfer'])).r;
  assert.ok(ok.ref);
  assert.equal((await db.call('payment_status', { ref: co2.ref })).status, 'paid');
  await db.c.query(`update app.settings set payment_mode = 'simulated'`);
  // a rent hold can be released
  await db.c.query(`insert into app.inspections(house_id, student_id, slot, fee, status, code) values ($1, $2, now(), 3000, 'completed', '1')`, [ids.h5, ids.s1]);
  await db.call('hold_room', { roomId: ids.h5r1 });
  await db.call('release_room', { roomId: ids.h5r1 });
  assert.equal((await db.one('select pay_hold_by from app.rooms where id = $1', [ids.h5r1])).pay_hold_by, null);
  const sv = (await db.one('select public.set_payout_verified($1, $2, $3, $4) r', [ids.a1, 'Kuda', '1234567890', 'KUNLE OLADIPO'])).r;
  assert.deepEqual(sv, {});
});
