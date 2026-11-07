-- Agent actions: listings, rooms, visits, payouts, verification documents.

-- Create or edit a listing. a = {editId, title, area, address, km, type, desc, amenities[], rules[],
--   shared, photos[], times[], days[], baths, availFrom, furnished, rooms:[{id, name, price, cap}]}
create or replace function public.save_listing(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare
  u uuid := app.need_agent(true); h app.houses; ex app.rooms; t timestamptz := app.now();
  v_title text := trim(coalesce(a->>'title', '')); v_address text := trim(coalesce(a->>'address', ''));
  v_shared boolean := coalesce((a->>'shared')::boolean, false); furn boolean := coalesce((a->>'furnished')::boolean, false);
  v_times text[]; v_days int[]; v_photos text[]; rr jsonb; keep uuid[] := '{}'; nm text; pr int; cp int; n int := 0;
  was_rejected boolean; i int := 0;
begin
  if v_title = '' or v_address = '' then perform app.fail('Add a house name, a street address and at least one room with a price.'); end if;
  select array_agg(x order by x) into v_times from jsonb_array_elements_text(coalesce(a->'times', '[]')) x where x ~ '^\d{2}:\d{2}$';
  select array_agg(x::int order by x::int) into v_days from jsonb_array_elements_text(coalesce(a->'days', '[]')) x where x ~ '^[0-6]$';
  if coalesce(array_length(v_times, 1), 0) = 0 or coalesce(array_length(v_days, 1), 0) = 0 then
    perform app.fail('Pick at least one day and one time for inspections.');
  end if;
  select coalesce(array_agg(x), '{}') into v_photos from (select x from jsonb_array_elements_text(coalesce(a->'photos', '[]')) x limit 8) s;
  select count(*) into n from jsonb_array_elements(coalesce(a->'rooms', '[]')) r
   where trim(coalesce(r->>'name', '')) <> '' and coalesce(nullif(regexp_replace(coalesce(r->>'price', ''), '\D', '', 'g'), '')::numeric, 0) > 0;
  if n = 0 then perform app.fail('Add a house name, a street address and at least one room with a price.'); end if;

  if nullif(a->>'editId', '') is not null then
    select * into h from app.houses where id = (a->>'editId')::uuid and agent_id = u and not deleted for update;
    if h.id is null then perform app.fail('Listing not found.'); end if;
    was_rejected := h.mod = 'rejected';
    update app.houses set title = v_title, area = coalesce(a->>'area', area), address = v_address,
      km = coalesce((a->>'km')::numeric, km), type = coalesce(a->>'type', type), descr = coalesce(nullif(trim(a->>'desc'), ''), 'No description yet.'),
      amenities = coalesce(array(select jsonb_array_elements_text(a->'amenities')), '{}'),
      rules = coalesce(array(select jsonb_array_elements_text(a->'rules')), '{}'),
      shared = v_shared, photos = v_photos, times = v_times, days = v_days,
      baths = greatest(1, least(30, coalesce((a->>'baths')::int, 1))), avail_from = nullif(a->>'availFrom', '')::date,
      mod = case when was_rejected then 'pending' else mod end
     where id = h.id;
    for rr in select * from jsonb_array_elements(coalesce(a->'rooms', '[]')) loop
      i := i + 1;
      nm := trim(coalesce(rr->>'name', ''));
      pr := nullif(regexp_replace(coalesce(rr->>'price', ''), '\D', '', 'g'), '')::int;
      cp := greatest(1, least(6, coalesce((rr->>'cap')::int, 1)));
      ex := null;
      if nullif(rr->>'id', '') is not null then
        select * into ex from app.rooms where id = (rr->>'id')::uuid and house_id = h.id;
      end if;
      if ex.id is not null then
        update app.rooms set name = coalesce(nullif(nm, ''), name), price = case when coalesce(pr, 0) > 0 then pr else price end,
          cap = case when v_shared then greatest(greatest(1, app.active_count(id)), cp) else greatest(1, app.active_count(id)) end,
          furnished = furn, sort = i, archived = false
         where id = ex.id;
        keep := keep || ex.id;
      elsif nm <> '' and coalesce(pr, 0) > 0 then
        insert into app.rooms(house_id, name, price, cap, furnished, sort)
        values (h.id, nm, pr, case when v_shared then cp else 1 end, furn, i) returning id into ex.id;
        keep := keep || ex.id;
      end if;
    end loop;
    -- rooms left out: archive, unless someone lives there or a ballot is running
    update app.rooms r set archived = true
     where r.house_id = h.id and not (r.id = any (keep)) and not r.archived
       and app.active_count(r.id) = 0 and r.hold_ballot is null
       and not exists (select 1 from app.ballots b where b.room_id = r.id and b.status in ('open', 'drawn'));
    perform app.note(null, format('%s %s %s.', app.pname(u), case when was_rejected then 'resubmitted' else 'edited' end, v_title));
    select * into h from app.houses where id = h.id;
    return jsonb_build_object('id', h.id, 'mod', h.mod, 'resubmitted', was_rejected);
  end if;

  insert into app.houses(agent_id, title, area, address, km, type, descr, amenities, rules, shared, photos, times, days, baths, avail_from, art, mod, created_at)
  values (u, v_title, coalesce(a->>'area', 'Damico'), v_address, coalesce((a->>'km')::numeric, 1), coalesce(a->>'type', 'Self-contain'),
    coalesce(nullif(trim(a->>'desc'), ''), 'No description yet.'),
    coalesce(array(select jsonb_array_elements_text(a->'amenities')), '{}'),
    coalesce(array(select jsonb_array_elements_text(a->'rules')), '{}'),
    v_shared, v_photos, v_times, v_days, greatest(1, least(30, coalesce((a->>'baths')::int, 1))), nullif(a->>'availFrom', '')::date,
    jsonb_build_object('wall', floor(random() * 7)::int, 'roof', floor(random() * 5)::int,
                       'kind', (array['bungalow', 'storey', 'flats'])[1 + floor(random() * 3)::int]),
    'pending', t)
  returning * into h;
  for rr in select * from jsonb_array_elements(coalesce(a->'rooms', '[]')) loop
    nm := trim(coalesce(rr->>'name', ''));
    pr := nullif(regexp_replace(coalesce(rr->>'price', ''), '\D', '', 'g'), '')::int;
    if nm <> '' and coalesce(pr, 0) > 0 then
      i := i + 1;
      insert into app.rooms(house_id, name, price, cap, furnished, sort)
      values (h.id, nm, pr, case when v_shared then greatest(1, least(6, coalesce((rr->>'cap')::int, 1))) else 1 end, furn, i);
    end if;
  end loop;
  perform app.note(null, format('New listing awaiting review: %s.', v_title));
  return jsonb_build_object('id', h.id, 'mod', 'pending');
end $$;

create or replace function app.my_house(hid uuid, u uuid) returns app.houses
language plpgsql stable as $$
declare h app.houses;
begin
  select * into h from app.houses where id = hid and agent_id = u and not deleted;
  if h.id is null then perform app.fail('Listing not found.'); end if;
  return h;
end $$;

create or replace function public.toggle_room_pause(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); h app.houses := app.my_house((a->>'houseId')::uuid, u); p boolean;
begin
  update app.rooms set paused = not paused where id = (a->>'roomId')::uuid and house_id = h.id returning paused into p;
  return jsonb_build_object('paused', p);
end $$;

create or replace function public.toggle_shared(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); h app.houses := app.my_house((a->>'houseId')::uuid, u); on_ boolean := not h.shared;
begin
  update app.houses set shared = on_ where id = h.id;
  if on_ then
    update app.rooms set cap = greatest(cap_saved, app.active_count(id)) where house_id = h.id and coalesce(cap_saved, 1) > 1;
  else
    update app.rooms set cap_saved = cap, cap = greatest(1, app.active_count(id)) where house_id = h.id and cap > 1;
  end if;
  return jsonb_build_object('shared', on_);
end $$;

create or replace function public.set_room_cap(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); h app.houses := app.my_house((a->>'houseId')::uuid, u); r app.rooms; n int;
begin
  if not h.shared then perform app.fail('Turn on shared rooms first.'); end if;
  select * into r from app.rooms where id = (a->>'roomId')::uuid and house_id = h.id for update;
  n := greatest(greatest(1, app.active_count(r.id)), least(6, r.cap + coalesce((a->>'d')::int, 0)));
  if n = r.cap then
    perform app.fail(case when r.cap >= 6 then 'A room can have at most 6 spaces.' else 'You cannot go below the tenants already in this room.' end);
  end if;
  update app.rooms set cap = n, cap_saved = n where id = r.id;
  return jsonb_build_object('cap', n);
end $$;

create or replace function public.toggle_listing_pause(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); h app.houses := app.my_house((a->>'id')::uuid, u); p boolean := not h.paused;
begin
  update app.houses set paused = p where id = h.id;
  perform app.note(null, format('%s %s %s.', app.pname(u), case when p then 'paused' else 'resumed' end, h.title));
  return jsonb_build_object('paused', p);
end $$;

-- What stops a listing from being deleted right now (empty = nothing).
create or replace function app.listing_busy(hid uuid) returns text[]
language sql stable as $$
  select array_remove(array[
    case when exists (select 1 from app.keys where house_id = hid and status = 'active') then 'current or upcoming tenants' end,
    case when exists (select 1 from app.inspections where house_id = hid and status = 'booked') then 'booked visits' end,
    case when exists (select 1 from app.ballots where house_id = hid and status in ('open', 'drawn')) then 'a running ballot' end
  ], null)
$$;

create or replace function public.delete_listing(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); h app.houses := app.my_house((a->>'id')::uuid, u); busy text[] := app.listing_busy(h.id);
begin
  if array_length(busy, 1) > 0 then perform app.fail('This listing still has ' || array_to_string(busy, ', ') || '.'); end if;
  update app.houses set deleted = true, paused = true, mod = 'deleted' where id = h.id;
  delete from app.favs where house_id = h.id;
  perform app.note(null, format('%s deleted %s.', app.pname(u), h.title));
  return '{}'::jsonb;
end $$;

-- Agent marks a visit done (the student did not enter the code).
create or replace function public.agent_complete_visit(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(); i app.inspections; h app.houses;
begin
  select i2.* into i from app.inspections i2 join app.houses h2 on h2.id = i2.house_id
   where i2.id = (a->>'id')::uuid and h2.agent_id = u for update of i2;
  if i.id is null or i.status <> 'booked' then perform app.fail('This visit is not open any more.'); end if;
  if i.slot > app.now() + interval '1 hour' then perform app.fail('You can mark a visit as done from an hour before it starts.'); end if;
  perform app.complete_visit(i.id);
  select * into h from app.houses where id = i.house_id;
  perform app.note(i.student_id, format('%s marked your visit at %s as done. Rent payment is unlocked.', app.pname(u), h.title));
  return '{}'::jsonb;
end $$;

create or replace function public.agent_cancel_visit(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); i app.inspections; h app.houses;
begin
  select i2.* into i from app.inspections i2 join app.houses h2 on h2.id = i2.house_id
   where i2.id = (a->>'id')::uuid and h2.agent_id = u for update of i2;
  if i.id is null or i.status <> 'booked' then perform app.fail('This visit is not open any more.'); end if;
  select * into h from app.houses where id = i.house_id;
  update app.inspections set status = 'cancelled', refunded = true where id = i.id;
  perform app.refund_payment_row(i.payment_id);
  update app.agents set cancels = cancels + 1 where id = u;
  perform app.update_trust(u);
  perform app.note(i.student_id, format('%s cancelled your visit at %s. %s refunded.', app.pname(u), h.title, app.naira(i.fee)));
  return '{}'::jsonb;
end $$;

create or replace function public.mark_missed(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(); i app.inspections; h app.houses;
begin
  select i2.* into i from app.inspections i2 join app.houses h2 on h2.id = i2.house_id
   where i2.id = (a->>'id')::uuid and h2.agent_id = u for update of i2;
  if i.id is null or i.status <> 'booked' then perform app.fail('This visit is not open any more.'); end if;
  if i.slot > app.now() then perform app.fail('You can mark a student as missing once the visit time has passed.'); end if;
  select * into h from app.houses where id = i.house_id;
  update app.inspections set status = 'missed' where id = i.id;
  perform app.note(i.student_id, format('%s marked that you missed your visit to %s. The fee is not refunded. You can book another visit.', app.pname(u), h.title));
  return '{}'::jsonb;
end $$;

-- Agent posts a public complaint about one of their tenants.
create or replace function public.post_tenant_complaint(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(); k app.keys; h app.houses; txt text := trim(coalesce(a->>'text', ''));
begin
  select k2.* into k from app.keys k2 join app.houses h2 on h2.id = k2.house_id where k2.code = a->>'code' and h2.agent_id = u;
  if k.id is null or txt = '' then perform app.fail('Choose a tenant and write what happened.'); end if;
  select * into h from app.houses where id = k.house_id;
  insert into app.complaints(kind, author_id, author_name, author_role, about, house_id, agent_id, tenant_id, tenant_name, body, status, created_at)
  values ('public', u, app.short_name(u), 'owner', 'tenant', h.id, u, k.student_id, app.pname(k.student_id), txt, 'open', app.now());
  perform app.note(null, format('New complaint about tenant %s.', app.pname(k.student_id)));
  perform app.note(k.student_id, format('%s posted a public complaint about you. You can reply from My lodge.', app.pname(u)));
  return '{}'::jsonb;
end $$;

-- Payout account. In simulated mode the account name is the agent's own name;
-- with Paystack the paystack-resolve edge function checks it with the bank first.
create or replace function public.check_payout(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); acct text := regexp_replace(coalesce(a->>'acct', ''), '\D', '', 'g');
begin
  if length(acct) <> 10 then perform app.fail('Enter the 10-digit account number.'); end if;
  if (app.cfg()).payment_mode = 'paystack' then perform app.fail('Use the bank check in the app.'); end if;
  return jsonb_build_object('name', upper(app.pname(u)));
end $$;

create or replace function public.save_payout(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_agent(true); acct text := regexp_replace(coalesce(a->>'acct', ''), '\D', '', 'g'); bank text := trim(coalesce(a->>'bank', ''));
begin
  if length(acct) <> 10 or bank = '' then perform app.fail('Enter the bank and the 10-digit account number.'); end if;
  if (app.cfg()).payment_mode = 'paystack' then perform app.fail('Use the bank check in the app.'); end if;
  perform app.set_payout(u, bank, acct, upper(app.pname(u)));
  return '{}'::jsonb;
end $$;

create or replace function app.set_payout(u uuid, bank text, acct text, nm text) returns void
language plpgsql as $$
begin
  update app.agents set payout_bank = bank, payout_acct = acct, payout_name = nm where id = u;
  perform app.note(u, format('Your payout account was changed to %s •••• %s. If this wasn''t you, contact {{APP_NAME}} support.', bank, right(acct, 4)));
end $$;

-- Called by the paystack-resolve edge function (service role only) after the bank confirmed the name.
create or replace function public.set_payout_verified(p_agent uuid, p_bank text, p_acct text, p_name text) returns jsonb
language plpgsql security definer set search_path = app, public as $$
begin
  if app.role_of(p_agent) <> 'agent' then return jsonb_build_object('error', 'not an agent'); end if;
  perform app.set_payout(p_agent, p_bank, p_acct, p_name);
  return '{}'::jsonb;
end $$;

-- Verification documents (first time, or after admin asked for changes).
-- a = {idType, idFile, proofType, proofFile, btype, rel, files:[storage paths]}
create or replace function public.submit_agent_docs(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); ag app.agents; p app.profiles; lines jsonb; resub boolean;
begin
  if app.role_of(u) <> 'agent' then perform app.fail('Only agents can do this.'); end if;
  if coalesce(a->>'idFile', '') = '' then perform app.fail('Upload your ID document.'); end if;
  if coalesce(a->>'proofFile', '') = '' then perform app.fail('Upload proof that you can let the property.'); end if;
  select * into ag from app.agents where id = u for update;
  select * into p from app.profiles where id = u;
  if ag.status in ('verified', 'suspended') then perform app.fail('Your account is already reviewed.'); end if;
  resub := jsonb_array_length(ag.docs) > 0;
  lines := jsonb_build_array(
    'Business type: ' || coalesce(nullif(a->>'btype', ''), ag.btype, 'Not given'),
    'Relationship to the property: ' || coalesce(nullif(a->>'rel', ''), ag.rel, 'Not given'),
    case when p.phone is not null then 'Phone ' || p.phone else 'No phone given' end,
    'Email ' || coalesce(p.email, 'not given') || ' confirmed by code',
    (a->>'idType') || ': ' || (a->>'idFile'),
    (a->>'proofType') || ': ' || (a->>'proofFile'));
  update app.agents set docs = lines, doc_files = coalesce(a->'files', '[]'::jsonb),
    btype = coalesce(nullif(a->>'btype', ''), btype), rel = coalesce(nullif(a->>'rel', ''), rel),
    status = 'pending', reject_reason = null
   where id = u;
  perform app.note(null, case when resub then format('%s sent new verification documents.', p.name)
                              else format('%s applied to list houses on {{APP_NAME}}.', p.name) end);
  return jsonb_build_object('resubmitted', resub);
end $$;
