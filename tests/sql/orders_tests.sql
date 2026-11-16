\pset footer off
-- Customer orders in the app (supabase/setup.sql section 15). Run after ai_tests.sql.
-- 11111111 = owner/admin, 55555555 = a customer (زبون تجربة), 66666666 = another signed-in customer, 77777777 = seller@test.local
insert into public.products (shop_id, owner_id, title, cat, cond, price, qty, cost, sku)
select s.id, s.owner_id, x.t, 'other', 'original', x.p, x.q, x.c, x.k
from (select * from public.shops where owner_id = '11111111-1111-1111-1111-111111111111' order by created_at limit 1) s,
     (values ('فلتر طلبات', 40::numeric, 3, 25::numeric, 'ORD-1'), ('زيت طلبات', 15::numeric, null::integer, 9::numeric, 'ORD-2'),
             ('قطعة سعرها مخفي', 99::numeric, 5, 60::numeric, 'ORD-H')) x(t, p, q, c, k);
update public.products set hide_price = true where sku = 'ORD-H';
update public.settings set orders_enabled = false, shop_closed = false, price_mode = 'all', hide_qty = false where id = 1;
update public.staff set perms = array['sales', 'products'] where email = 'seller@test.local';
-- the test's own lookups (customers and the seller cannot read these tables directly, by design)
create temp view t_parts as select sku, id, qty, status from public.products where sku like 'ORD-%';
create temp view t_orders as select id, no, status from public.invoices where source = 'app';
grant select on t_parts, t_orders to anon, authenticated;

set role anon; select set_config('request.jwt.claim.sub', '', false);
\echo O1 expect sign in to order (a visitor cannot order):
select public.place_order('{}'::jsonb);
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
\echo O2 expect orders are closed (the owner has not opened orders):
select public.place_order(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 1))));
reset role;
update public.settings set orders_enabled = true where id = 1;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
create temp table o_before as select (public.sales_report(now() - interval '1 day', now() + interval '1 day')->>'count')::integer as n;
grant select on o_before to authenticated;

set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
\echo O3 expect delivery needs an address:
select public.place_order(jsonb_build_object('delivery', 'delivery', 'address', 'x', 'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 1))));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo O4a expect order needs a name (no name given, no profile):
select public.place_order(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 1))));
\echo O4b expect order needs a phone:
select public.place_order(jsonb_build_object('name', 'علي', 'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 1))));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'O5 an order (expect preparing, app, 95, 2 lines, pickup, زبون تجربة, the price from the database)' t, r->>'status' status, r->>'source' src, (r->>'total')::numeric total,
       jsonb_array_length(r->'items') lines, r->>'delivery' delivery, r->>'customer_name' name, (r->'items'->0->>'price')::numeric price
from public.place_order(jsonb_build_object('phone', '0921112233', 'note', 'بسرعة لو سمحت',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 2, 'price', 1),
                             jsonb_build_object('id', (select id from t_parts where sku = 'ORD-2'), 'qty', 1)))) r;
\echo O6 expect not enough stock: فلتر طلبات (available 1):
select public.place_order(jsonb_build_object('phone', '0921112233', 'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 5))));
reset role;
select 'O7 the parts are kept for the order (expect 1)' t, qty from public.products where sku = 'ORD-1';
update public.settings set hide_qty = true where id = 1;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
\echo O8 expect not enough stock: فلتر طلبات (no number: the owner hides quantities):
select public.place_order(jsonb_build_object('phone', '0921112233', 'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 5))));
reset role;
update public.settings set hide_qty = false where id = 1;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'O9 not a sale yet: the report does not count it (expect t)' t, ((public.sales_report(now() - interval '1 day', now() + interval '1 day')->>'count')::integer = (select n from o_before)) same;
reset role;
select 'O10 nor is it a debt (expect 0)' t, count(*) from public.invoices where customer_name = 'زبون تجربة' and status = 'done';

-- a part whose price is hidden: it can be ordered, the customer does not see the price
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'O11 a hidden price (expect preparing, null total, null price)' t, r->>'status' status, r->'total' total, r->'items'->0->'price' price
from public.place_order(jsonb_build_object('phone', '0921112233', 'delivery', 'delivery', 'address', 'طرابلس - حي الأندلس، قرب الجامع',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-H'), 'qty', 1)))) r;
select 'O12 my orders, the open ones first (expect 2, preparing, preparing)' t, count(*), min(r->>'status'), max(r->>'status') from public.my_orders() r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'O13 another customer cannot see it (expect t, 0)' t, public.my_order((select id from t_orders order by no limit 1)) is null hidden, (select count(*) from public.my_orders()) mine;
\echo O14 expect not authorized (customers do not list the orders of the shop):
select public.list_orders();
\echo O15 expect not authorized (nor prepare them):
select public.order_set((select id from t_orders order by no limit 1), 'ready');
reset role;

-- the seller (sales) prepares and hands over
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'O16 the orders waiting (expect 2, 0, 2, 95)' t, r->'counts'->'preparing' preparing, r->'counts'->'ready' ready, jsonb_array_length(r->'items') n, (r->'items'->0->>'total')::numeric first_total
from public.list_orders() r;
select 'O17 the seller sees the hidden price (expect 99)' t, (public.my_order((select id from t_orders order by no desc limit 1))->>'total')::numeric total;
select 'O18 ready (expect ready, true)' t, r->>'status' status, (r->>'ready_at') is not null has_ready
from public.order_set((select id from t_orders order by no limit 1), 'ready') r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
\echo O19 expect order can no longer be cancelled (it is ready):
select public.cancel_my_order((select id from t_orders order by no limit 1));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
\echo O20 expect order not received yet (a return needs a received sale):
select public.return_invoice((select id from t_orders order by no limit 1));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo O21 expect bad order status (ready twice):
select public.order_set((select id from t_orders order by no limit 1), 'ready');
select 'O22 received, on credit (expect done, 0, credit, بائع, t)' t, r->>'status' status, (r->>'paid')::numeric paid, r->>'payment' payment, r->>'staff_name' staff,
       (r->>'created_at')::timestamptz > now() - interval '1 minute' dated_today
from public.order_set((select id from t_orders order by no limit 1), 'done', 'credit') r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'O23 now a sale in the report (expect t)' t, ((public.sales_report(now() - interval '1 day', now() + interval '1 day')->>'count')::integer = (select n from o_before) + 1) counted;
select 'O24 and a debt in the customer''s account (expect 95)' t, (r->>'balance')::numeric balance
from public.buyer_detail((select public.cust_key(customer_name, customer_phone) from public.invoices where source = 'app' order by no limit 1)) r;
reset role;

-- cancelled: by the customer while it is prepared, or by the shop with a reason; the parts go back
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'O25 cancelled by the customer (expect cancelled)' t, r->>'status' status
from public.cancel_my_order((select id from t_orders where status = 'preparing' order by no limit 1)) r;
select 'O25b its part is back in stock (expect 5)' t, qty from t_parts where sku = 'ORD-H';
select 'O26 another order' t, r->>'status' status from public.place_order(jsonb_build_object('phone', '0921112233',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-1'), 'qty', 1)))) r;
reset role;
select 'O27 the last one is taken (expect 0, sold)' t, qty, status from public.products where sku = 'ORD-1';
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'O28 cancelled by the shop with a reason (expect cancelled, الزبون ما جاش)' t, r->>'status' status, r->>'cancel_reason' reason
from public.order_set((select id from t_orders where status = 'preparing' order by no desc limit 1), 'cancelled', null, 'الزبون ما جاش') r;
\echo O29 expect bad order status (a cancelled order stays cancelled):
select public.order_set((select id from t_orders where status = 'cancelled' order by no desc limit 1), 'done');
reset role;
select 'O30 back in stock and on sale (expect 1, active)' t, qty, status from public.products where sku = 'ORD-1';

-- at most 5 waiting orders per customer
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin for i in 1..5 loop perform public.place_order(jsonb_build_object('phone', '0921112233', 'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-2'), 'qty', 1)))); end loop; end $$;
\echo O31 expect too many open orders:
select public.place_order(jsonb_build_object('phone', '0921112233', 'items', jsonb_build_array(jsonb_build_object('id', (select id from t_parts where sku = 'ORD-2'), 'qty', 1))));
reset role;

-- the activity log
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'O32 the log (expect order, order_cancelled, order_done, order_ready)' t, string_agg(distinct kind, ', ' order by kind) kinds from public.activity_log where kind like 'order%';
select 'O33 the customer''s name in the log, not the e-mail (expect زبون تجربة)' t, actor_name from public.activity_log where kind = 'order' order by id limit 1;
select 'O34 under «sales» in the log (expect t)' t, exists (select 1 from jsonb_array_elements(public.list_activity('sales')->'items') a where a->>'kind' like 'order%') shown;
select 'O35 the cancel reason and payment kept (expect الزبون ما جاش, credit)' t,
       (select detail->>'reason' from public.activity_log where kind = 'order_cancelled' and detail ? 'reason' and detail->>'reason' <> '' order by id desc limit 1) reason,
       (select detail->>'payment' from public.activity_log where kind = 'order_done' order by id desc limit 1) payment;
reset role;
