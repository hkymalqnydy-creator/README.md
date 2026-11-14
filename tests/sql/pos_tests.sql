\pset footer off
-- Sales system checks. Run after behaviour.sql, country_tests.sql and company_tests.sql.
-- 11111111 = owner/admin, 66666666 = signed-in user who is not staff, 77777777 = seller (created below)
insert into public.products (shop_id, owner_id, title, cat, cond, price, qty, cost, sku)
select s.id, s.owner_id, 'POS test item', 'other', 'original', 50, 5, 30, 'POS-1' from public.shops s where s.owner_id = '11111111-1111-1111-1111-111111111111' order by s.created_at limit 1;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo P1 expect not authorized (not staff):
select public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-000000000000'))));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'P2 staff added before sign-up' t, (r->>'user_id') is null as not_linked_yet from public.save_staff('Seller@Test.local', 'بائع', array['sales', 'bogus'], null, true) r;
reset role;
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'seller@test.local');
select 'P3 linked on sign-up' t, user_id, perms from public.staff where email = 'seller@test.local';
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'P4 my_perms' t, public.my_perms() ->> 'staff' staff, public.my_perms() -> 'perms' perms;
select 'P5 invoice 2 x 50 (price override ignored)' t, (r->>'total')::numeric total, (r->>'no') is not null has_no, jsonb_array_length(r->'items') lines, (r->'items'->0) ? 'cost' cost_leak
from public.create_invoice(jsonb_build_object('payment', 'cash', 'customer_name', 'زبون كاش',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'POS-1'), 'qty', 2, 'price', 10)))) r;
reset role;
select 'P6 stock after sale (expect 3)' t, qty from public.products where sku = 'POS-1';
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo P7 expect discount not authorized:
select public.create_invoice(jsonb_build_object('discount', 5, 'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'POS-1'), 'qty', 1))));
\echo P8 expect not enough stock:
select public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'POS-1'), 'qty', 10))));
select 'P9 seller sees own invoices' t, count(*) from public.list_invoices();
\echo P10 expect report not authorized:
select public.sales_report(now() - interval '1 day', now() + interval '1 day');
select 'P11 seller sees prices, not cost' t, (r->>'price') is not null priced, (r->>'cost') is null no_cost from public.search_products() r where r->>'sku' = 'POS-1';
\echo P12 expect RLS block on product edit without products perm (0 rows):
update public.products set price = 1 where sku = 'POS-1';
select 'P12b price unchanged (expect 0 rows at price 1)' t, count(*) from public.products where sku = 'POS-1' and price = 1;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'P13 outsider sees no invoices / staff' t, (select count(*) from public.list_invoices()) inv, (select count(*) from public.staff) staff;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'P14 owner report' t, r->>'count' cnt, r->>'total' total, r->>'profit' profit, r->'by_payment' pay from public.sales_report(now() - interval '1 day', now() + interval '1 day') r;
select 'P15 grant returns + products' t, perms from public.save_staff('seller@test.local', 'بائع', array['sales', 'returns', 'products'], null, true) r, jsonb_to_record(r) as x(perms text[]);
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'P16 return restocks' t, r->>'status' status from public.return_invoice((select id from public.invoices order by created_at desc limit 1)) r;
\echo P17 expect already returned:
select public.return_invoice((select id from public.invoices order by created_at desc limit 1));
update public.products set price = 55 where sku = 'POS-1';
reset role;
select 'P18 stock back to 5, price edited by staff with products perm' t, qty, price from public.products where sku = 'POS-1';
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'P19 deactivate staff' t, (r->>'active') active from public.save_staff('seller@test.local', 'بائع', array['sales'], null, false) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'P20 inactive staff' t, public.my_perms() ->> 'staff' staff;
\echo P21 expect not authorized (inactive):
select public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-000000000000'))));
reset role;
