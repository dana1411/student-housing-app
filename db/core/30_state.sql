-- get_state(): everything the signed-in person is allowed to see, in the shape
-- the UI works with (times in epoch milliseconds, camelCase keys).
-- Anonymous visitors get public listings only.

create or replace function app.agent_json(a app.agents, p app.profiles, is_full boolean, with_phone boolean)
returns jsonb language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'name', p.name, 'biz', a.biz, 'status', a.status,
    'since', to_char(coalesce(a.verified_at, a.created_at), 'Mon YYYY'),
    'resp', a.resp, 'rating', round(a.rating, 2), 'ratings', a.ratings, 'trust', a.trust,
    'inspDone', a.insp_done, 'disputes', a.disputes, 'cancels', a.cancels,
    'mismatches', a.mismatches, 'noShows', a.no_shows, 'bio', a.bio, 'photo', p.photo,
    'phone', case when with_phone or is_full then p.phone end,
    'email', case when is_full then p.email end,
    'payout', case when is_full then coalesce(a.payout_bank || ' •••• ' || right(a.payout_acct, 4), 'Not added') end,
    'payoutName', case when is_full then a.payout_name end,
    'docs', case when is_full then a.docs end,
    'docFiles', case when is_full then a.doc_files end,
    'btype', case when is_full then a.btype end,
    'rel', case when is_full then a.rel end,
    'rejectReason', case when is_full then a.reject_reason end,
    'suspendReason', case when is_full then a.suspend_reason end,
    'prefs', case when is_full then p.prefs end,
    'created', app.ms(a.created_at)
  ))
$$;

create or replace function public.get_state() returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare
  u    uuid := auth.uid();
  me   app.profiles;
  v_role text;
  c    app.settings := app.cfg();
  t    timestamptz := app.now();
  res  jsonb;
begin
  if u is not null then
    select * into me from app.profiles where id = u and not deleted;
    v_role := me.role;
  end if;
  v_role := coalesce(v_role, 'anon');

  with
  hv as (  -- houses this person can see
    select h.* from app.houses h join app.agents a on a.id = h.agent_id
    where v_role = 'admin'
       or h.agent_id = u
       or (h.mod = 'live' and not h.deleted and a.status = 'verified')
       or (u is not null and (
            exists (select 1 from app.keys k where k.house_id = h.id and k.student_id = u)
         or exists (select 1 from app.inspections i where i.house_id = h.id and i.student_id = u)
         or exists (select 1 from app.payments p where p.house_id = h.id and p.student_id = u)
         or exists (select 1 from app.threads th where th.house_id = h.id and th.student_id = u)
         or exists (select 1 from app.favs f where f.house_id = h.id and f.student_id = u)
         or exists (select 1 from app.complaints cp where cp.house_id = h.id and (cp.author_id = u or cp.tenant_id = u))))
  ),
  kfull as (  -- keys shown in full (with the secret code)
    select k.* from app.keys k join app.houses h on h.id = k.house_id
    where v_role = 'admin' or k.student_id = u or h.agent_id = u
  ),
  kvis as (
    select k.*, true as is_full from kfull k
    union all
    select k.*, false as is_full from app.keys k
    where k.status = 'active' and k.house_id in (select id from hv)
      and k.id not in (select id from kfull)
  ),
  kcode as (
    select id, case when is_full then code else 'K-' || left(replace(id::text, '-', ''), 10) end as c from kvis
  ),
  rooms_j as (
    select r.house_id, jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'price', r.price, 'cap', r.cap, 'capSaved', r.cap_saved,
      'paused', r.paused, 'furnished', r.furnished, 'hold', r.hold_ballot,
      'payHold', case when r.pay_hold_until > t then jsonb_build_object(
          'by', case when r.pay_hold_by = u or v_role = 'admin' then r.pay_hold_by::text else 'other' end,
          'until', app.ms(r.pay_hold_until)) end,
      'occ', coalesce((select jsonb_agg(kc.c order by k.start_at) from app.keys k join kcode kc on kc.id = k.id
                        where k.room_id = r.id and k.status = 'active'), '[]'::jsonb)
    ) order by r.sort, r.name) as rooms
    from app.rooms r where r.house_id in (select id from hv) and not r.archived
    group by r.house_id
  ),
  houses_j as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', h.id, 'agentId', h.agent_id, 'title', h.title, 'area', h.area, 'address', h.address,
      'km', h.km, 'type', h.type, 'shared', h.shared, 'art', h.art, 'times', to_jsonb(h.times),
      'days', to_jsonb(h.days), 'baths', h.baths, 'availFrom', h.avail_from, 'desc', h.descr,
      'amenities', to_jsonb(h.amenities), 'rules', to_jsonb(h.rules), 'photos', to_jsonb(h.photos),
      'mod', h.mod, 'paused', h.paused, 'deleted', h.deleted,
      'removedReason', h.removed_reason, 'removedNote', h.removed_note, 'removedAt', app.ms(h.removed_at),
      'created', app.ms(h.created_at)
    )) || jsonb_build_object('rooms', coalesce(rj.rooms, '[]'::jsonb)) order by h.created_at), '[]'::jsonb) as j
    from hv h left join rooms_j rj on rj.house_id = h.id
  ),
  keys_j as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', k.id, 'code', kc.c, 'payId', case when k.is_full then k.payment_id end,
      'houseId', k.house_id, 'roomId', k.room_id,
      'studentId', case when k.is_full then k.student_id end,
      'start', app.ms(k.start_at), 'end', app.ms(k.end_at), 'status', k.status,
      'movedIn', case when k.is_full then k.moved_in else false end,
      'autoRenew', case when k.is_full then k.auto_renew else false end,
      'shown', case when k.is_full then to_jsonb(k.shown) else '[]'::jsonb end,
      'notRenewing', case when k.is_full then k.not_renewing else false end,
      'renewals', case when k.is_full then k.renewals else 0 end,
      'hidden', case when k.is_full then null else true end
    )) order by k.start_at), '[]'::jsonb) as j
    from kvis k join kcode kc on kc.id = k.id
  ),
  pay_j as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'studentId', p.student_id, 'houseId', p.house_id, 'roomId', p.room_id,
      'amount', p.amount, 'savingsUsed', p.savings_used, 'method', p.method, 'ref', p.ref,
      'time', app.ms(coalesce(p.paid_at, p.created_at)), 'status', p.status,
      'releasedAt', app.ms(p.released_at), 'paidOutAt', app.ms(p.paid_out_at),
      'refundNeeded', case when (p.meta->>'refund_needed')::boolean then true end
    )) order by coalesce(p.paid_at, p.created_at)), '[]'::jsonb) as j
    from app.payments p left join app.houses h on h.id = p.house_id
    where p.kind <> 'deposit' and p.status not in ('pending', 'expired')
      and (v_role = 'admin' or p.student_id = u or (h.agent_id = u and p.status <> 'failed'))
  ),
  ins_j as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', i.id, 'houseId', i.house_id, 'studentId', i.student_id, 'slot', app.ms(i.slot), 'fee', i.fee,
      'payId', i.payment_id, 'status', i.status,
      'code', case when v_role in ('admin', 'agent') or c.demo then i.code end,
      'rating', i.rating, 'mismatch', i.mismatch, 'moves', i.moves, 'r24', i.r24, 'r1', i.r1,
      'refunded', i.refunded, 'byAdmin', i.by_admin, 'doneAt', app.ms(i.done_at)
    )) order by i.slot), '[]'::jsonb) as j
    from app.inspections i join app.houses h on h.id = i.house_id
    where v_role = 'admin' or i.student_id = u or h.agent_id = u
  ),
  bal as (
    select b.*, h.agent_id,
      array(select e.student_id from app.ballot_entries e where e.ballot_id = b.id order by e.created_at) as ents
    from app.ballots b join app.houses h on h.id = b.house_id
    where v_role = 'admin' or h.agent_id = u
       or (b.status in ('open', 'drawn') and b.house_id in (select id from hv))
       or exists (select 1 from app.ballot_entries e where e.ballot_id = b.id and e.student_id = u)
  ),
  bal_j as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'houseId', b.house_id, 'roomId', b.room_id,
      'keyCode', (select kc.c from kcode kc where kc.id = b.key_id),
      'created', app.ms(b.created_at), 'drawAt', app.ms(b.draw_at), 'status', b.status,
      'entrants', (select coalesce(jsonb_agg(case when v_role = 'admin' or b.agent_id = u or x = u then x::text else 'x' || n end), '[]'::jsonb)
                   from unnest(b.ents) with ordinality as e(x, n)),
      'order', (select coalesce(jsonb_agg(case when v_role = 'admin' or b.agent_id = u or x = u then x::text else 'x' || n end), '[]'::jsonb)
                from unnest(b.draw_order) with ordinality as e(x, n)),
      'offerIdx', b.offer_idx, 'offerAt', coalesce(app.ms(b.offer_at), 0),
      'winnerKey', (select kc.c from kcode kc where kc.id = b.winner_key)
    ) order by b.created_at), '[]'::jsonb) as j
    from bal b
  ),
  thr as (
    select th.* from app.threads th
    where v_role = 'admin' or th.student_id = u or th.agent_id = u
  ),
  thr_j as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', th.id, 'houseId', th.house_id, 'studentId', th.student_id, 'agentId', th.agent_id,
      'reported', th.reported, 'reportReason', th.report_reason, 'reportedBy', th.reported_by,
      'reportedAt', app.ms(th.reported_at), 'reportStatus', th.report_status,
      'blocked', th.blocked, 'blockedBy', th.blocked_by
    )) || jsonb_build_object('msgs', coalesce((
      select jsonb_agg(jsonb_build_object('from', m.sender, 'text', m.body, 't', app.ms(m.created_at),
                                          'read', m.read, 'flag', m.flag) order by m.created_at, m.id)
      from app.messages m where m.thread_id = th.id), '[]'::jsonb)) order by th.created_at), '[]'::jsonb) as j
    from thr th
  ),
  comp_j as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', cp.id, 'kind', cp.kind,
      'authorId', case when v_role = 'admin' or cp.author_id = u or app.role_of(cp.author_id) = 'agent' then cp.author_id end,
      'authorName', cp.author_name,
      'authorRole', cp.author_role, 'about', cp.about, 'houseId', cp.house_id, 'agentId', cp.agent_id,
      'tenantId', case when v_role = 'admin' or cp.tenant_id = u or cp.agent_id = u then cp.tenant_id end,
      'tenantName', case when v_role = 'admin' or cp.tenant_id = u or cp.agent_id = u or cp.tenant_name is null then cp.tenant_name
                         else split_part(cp.tenant_name, ' ', 1) || ' ' || left(split_part(cp.tenant_name, ' ', 2), 1) || '.' end,
      'reason', cp.reason, 'payId', case when v_role = 'admin' or cp.author_id = u or cp.agent_id = u then cp.payment_id end,
      'text', cp.body, 'status', cp.status, 'reply', cp.reply, 'replyBy', cp.reply_by,
      'removed', cp.removed, 't', app.ms(cp.created_at)
    )) order by cp.created_at desc), '[]'::jsonb) as j
    from app.complaints cp
    where v_role = 'admin' or cp.author_id = u or cp.agent_id = u or cp.tenant_id = u
       or (cp.kind = 'public' and not cp.removed)
  ),
  notes_j as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'to', coalesce(n.user_id::text, 'admin'), 'text', n.body, 't', app.ms(n.created_at), 'read', n.read
    ) order by n.created_at desc, n.id desc), '[]'::jsonb) as j
    from (select * from app.notifications n
          where u is not null and (n.user_id = u or (v_role = 'admin' and n.user_id is null))
          order by n.created_at desc limit 200) n
  ),
  -- people named in what this person can see
  stu_ids as (
    select u as id where v_role = 'student'
    union select student_id from kvis where is_full
    union select student_id from app.inspections i join app.houses h on h.id = i.house_id where h.agent_id = u
    union select student_id from thr
    union select x from bal b, unnest(b.ents || b.draw_order) x where b.agent_id = u
    union select student_id from app.payments p join app.houses h on h.id = p.house_id where h.agent_id = u
    union select p.id from app.profiles p where p.role = 'student' and v_role = 'admin'
  ),
  stu_j as (
    select coalesce(jsonb_object_agg(p.id, jsonb_strip_nulls(jsonb_build_object(
      'name', p.name, 'dept', p.dept, 'photo', p.photo, 'school', p.school,
      'suspended', p.suspended, 'suspendReason', case when p.id = u or v_role = 'admin' then p.suspend_reason end,
      'email', case when p.id = u or v_role = 'admin' then p.email end,
      'phone', case when p.id = u or v_role = 'admin' then p.phone end,
      'prefs', case when p.id = u then p.prefs end,
      'created', app.ms(p.created_at)
    ))), '{}'::jsonb) as j
    from app.profiles p where p.role = 'student' and p.id in (select id from stu_ids where id is not null)
  ),
  ag_j as (
    select coalesce(jsonb_object_agg(a.id, app.agent_json(a, p,
      v_role = 'admin' or a.id = u,
      exists (select 1 from app.inspections i join app.houses h on h.id = i.house_id
              where i.student_id = u and h.agent_id = a.id)
      or exists (select 1 from app.keys k join app.houses h on h.id = k.house_id
                 where k.student_id = u and h.agent_id = a.id))), '{}'::jsonb) as j
    from app.agents a join app.profiles p on p.id = a.id
    where v_role = 'admin' or a.id = u or a.status = 'verified'
       or a.id in (select agent_id from hv)
  ),
  sav_j as (
    select jsonb_build_object(
      'goal', coalesce((select jsonb_build_object('name', g.name, 'target', g.target, 'due', to_char(g.due, 'YYYY-MM-DD'),
                         'mode', g.mode, 'sched', g.sched, 'schedAmt', g.sched_amt, 'nextAuto', app.ms(g.next_auto))
                        from app.savings_goals g where g.student_id = u),
                       jsonb_build_object('name', 'Next session rent', 'target', 300000,
                         'due', to_char(t + interval '120 days', 'YYYY-MM-DD'), 'mode', 'flexible',
                         'sched', 'none', 'schedAmt', 0, 'nextAuto', null)),
      'txns', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'type', x.type, 'amt', x.amt,
                         't', app.ms(x.created_at), 'note', x.note) order by x.created_at desc)
                        from app.savings_txns x where x.student_id = u), '[]'::jsonb)) as j
  )
  select jsonb_build_object(
    'me', case when me.id is null then null else jsonb_strip_nulls(jsonb_build_object(
            'id', me.id, 'role', me.role, 'name', me.name, 'email', me.email, 'phone', me.phone,
            'photo', me.photo, 'dept', me.dept, 'suspended', me.suspended)) end,
    'cfg', jsonb_build_object('fee', c.insp_fee, 'comm', c.commission, 'term', c.term_days,
            'demo', c.demo, 'shift', c.shift_ms, 'paymentMode', c.payment_mode, 'holdMin', c.hold_minutes,
            'visitCutH', c.visit_cut_h, 'releaseDays', c.release_days, 'ballotDays', c.ballot_days,
            'offerHours', c.offer_hours),
    'now', app.ms(t),
    'houses', (select j from houses_j),
    'keys', (select j from keys_j),
    'payments', (select j from pay_j),
    'inspections', (select j from ins_j),
    'ballots', (select j from bal_j),
    'threads', (select j from thr_j),
    'complaints', (select j from comp_j),
    'notes', (select j from notes_j),
    'students', (select j from stu_j),
    'agents', (select j from ag_j),
    'favs', coalesce((select jsonb_agg(f.house_id order by f.created_at) from app.favs f where f.student_id = u), '[]'::jsonb),
    'savings', (select j from sav_j),
    'support', case when v_role = 'admin' then coalesce((select jsonb_agg(jsonb_build_object(
                  'id', s.id, 'name', s.name, 'contact', s.contact, 'who', s.who, 'topic', s.topic, 'msg', s.msg,
                  't', app.ms(s.created_at), 'status', s.status) order by s.created_at desc) from app.support s), '[]'::jsonb)
                else '[]'::jsonb end,
    'waitlist', case when v_role = 'admin' then coalesce((select jsonb_agg(jsonb_build_object(
                  'school', w.school, 'contact', w.contact, 'who', w.who, 't', app.ms(w.created_at)))
                  from app.waitlist w), '[]'::jsonb) else '[]'::jsonb end
  ) into res;
  return res;
end $$;
