\pset footer off
-- The warehouse (supabase/setup.sql section 18): every new invoice waits there with where each part is kept; the warehouse
-- employee ticks the lines and «تم التجهيز». Run after merchants_tests.sql. 11111111 = owner, 77777777 = seller@test.local,
-- 44444444 = a warehouse employee (يوسف).
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'store@test.local') on conflict do nothing;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
-- nobody in the warehouse yet: a sale does not wait for anyone (nothing piles up)
create temp table w_before as select (r->>'id')::uuid id from public.create_invoice(jsonb_build_object('payment', 'cash',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'MK-1'), 'qty', 1)))) r;
grant select on w_before to authenticated;
select 'W0 no warehouse employee: the sale does not wait (expect none)' t, coalesce((select pick_state from public.invoices where id = (select id from w_before)), 'none') st;
select 'W1 a warehouse employee (expect warehouse)' t, r->'perms'->>0 perm from public.save_staff('store@test.local', 'يوسف', array['warehouse'], null, true) r;
update public.products set location = 'رف A3 · خانة 12' where sku = 'MK-1';
create temp table w_sale as select (r->>'id')::uuid id, (r->>'no') no from public.create_invoice(jsonb_build_object('payment', 'cash', 'customer_name', 'ورشة الشمال',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'MK-1'), 'qty', 2)))) r;
grant select on w_sale to authenticated;
select 'W2 now a new invoice waits in the warehouse; the one from before does not (expect waiting, none)' t, (select pick_state from public.invoices where id = (select id from w_sale)) st,
  coalesce((select pick_state from public.invoices where id = (select id from w_before)), 'none') before;
reset role;
update public.staff set user_id = '44444444-4444-4444-4444-444444444444' where email = 'store@test.local';
set role authenticated; select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select 'W3 the employee sees it with where the part is (expect t, رف A3 · خانة 12, 2, f)' t, r->>'id' = (select id::text from w_sale) it,
  r->'lines'->0->>'location' location, r->'lines'->0->>'qty' qty, r->'lines'->0->>'picked' picked
from public.pick_list() r where r->>'id' = (select id::text from w_sale);
select 'W4 the count on his tab (expect t)' t, public.pick_waiting() >= 1 counted;
select 'W5 he ticks the line (expect t, 0)' t, (r->>'picked')::boolean picked, (r->>'left')::integer left_n
from public.pick_line((select (x->'lines'->0->>'id')::bigint from public.pick_list() x where x->>'id' = (select id::text from w_sale)), true) r;
select 'W6 done (expect t)' t, (r->>'no') = (select no from w_sale) same from public.pick_done((select id from w_sale)) r;
reset role;
select 'W6b (expect done, يوسف, t)' t, pick_state, picked_name, picked_at is not null at from public.invoices where id = (select id from w_sale);
set role authenticated; select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
\echo W7 expect invoice not waiting (prepared already):
select public.pick_done((select id from w_sale));
select 'W8 in the done list, not the waiting one (expect t, f)' t, exists (select 1 from public.pick_list('done') r where r->>'id' = (select id::text from w_sale)) done_list,
  exists (select 1 from public.pick_list() r where r->>'id' = (select id::text from w_sale)) waiting_list;
reset role;
select 'W9 the log names it (expect picked)' t, kind from public.activity_log where kind = 'picked' and ref = (select id::text from w_sale);
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo W10 expect not authorized (a seller without the warehouse permission):
select count(*) from public.pick_list();
select 'W11 and no count for him (expect 0)' t, public.pick_waiting();
reset role;
set role anon; select set_config('request.jwt.claim.sub', '', false);
\echo W12 expect permission denied (a visitor):
select public.pick_waiting();
reset role;
-- where a part is kept travels with it: the search shows it to the company's people only, a purchase sets it for a new part,
-- and the Excel import sets and changes it
create temp table w_mk as select id from public.products where sku = 'MK-1';   -- read here: a customer cannot read the table itself
grant select on w_mk to authenticated;
set role authenticated; select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select 'W13 the employee finds where the part is (expect رف A3 · خانة 12)' t, r->>'location' location
from public.search_products(p_ids => array[(select id from w_mk)], p_include_sold => true) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'W14 a customer does not (expect 1, [])' t, count(*) n, '[' || string_agg(r->>'location', '') || ']' location
from public.search_products(p_ids => array[(select id from w_mk)], p_include_sold => true) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'W15 a purchase with a new part (expect 1)' t, (r->>'new')::integer made from public.receive_stock(jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('part_no', 'WH-55-01', 'title', 'حساس أكسجين', 'qty', 3, 'cost', 40, 'location', '  رف C2 · خانة 7  ')))) r;
select 'W16 the Excel import sets and changes it (expect 1 inserted, 1 updated)' t,
  (select (r->>'inserted')::integer from public.import_products('[{"sku":"WH-IMP-1","title":"طرمبة بنزين","location":"رف B4 · خانة 1"}]'::jsonb) r) inserted,
  (select (r->>'updated')::integer from public.import_products('[{"sku":"MK-1","location":"رف A4 · خانة 2"}]'::jsonb) r) updated;
reset role;
select 'W17 (expect WH-IMP-1 رف B4 · خانة 1, WH-55-01 رف C2 · خانة 7, MK-1 رف A4 · خانة 2)' t, string_agg(coalesce(sku, part_no) || ' ' || location, ', ' order by coalesce(sku, part_no) desc) places
from public.products where part_no = 'WH-55-01' or sku in ('WH-IMP-1', 'MK-1');
