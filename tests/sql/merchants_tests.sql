\pset footer off
-- Merchants: shop name, «صادر ووارد», sending invoices, the owner's new password (supabase/setup.sql section 16). Run after stock_tests.sql.
-- 11111111 = owner/admin, 55555555 = an approved merchant (زبون تجربة, 0911111111), 66666666 = a signed-in customer with no account row,
-- 77777777 = seller@test.local (sales, products), 88888888 = a new merchant, 99999999 = someone who signs up with 55555555's number
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'amal@test.local'), ('99999999-9999-9999-9999-999999999999', '218911111111@phone.invalid');
update public.settings set orders_enabled = true, shop_closed = false, price_mode = 'all' where id = 1;
create temp view t_inv as select id, no, status, source, customer_id, sent_at, customer_phone from public.invoices;
grant select on t_inv to anon, authenticated;
create temp view t_part as select id, sku from public.products where sku = 'ORD-2';
grant select on t_part to anon, authenticated;

set role authenticated; select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
insert into public.customers (name, shop_name, phone, city) values ('سالم', 'محل الأمل لقطع الغيار', '0912223344', 'مصراتة');
select 'MC1 a merchant signs up with his shop (expect محل الأمل لقطع الغيار, not approved)' t, shop_name, approved from public.customers;
\echo MC2 expect a check violation (a shop name longer than 80):
update public.customers set shop_name = repeat('م', 81);
\echo MC3 expect permission denied (the statement is read through my_book, not directly):
select public.merchant_book('88888888-8888-8888-8888-888888888888');
select 'MC4 a new merchant: nothing yet, no total before approval (expect 0, 0, 0, null)' t, jsonb_array_length(r->'invoices') inv, jsonb_array_length(r->'orders') ord,
       jsonb_array_length(r->'payments') pay, r->>'balance' bal from public.my_book() r;
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'MC5 no account row: no statement (expect null)' t, public.my_book() is null as none;
reset role;

-- the owner sells to 0911111111 on credit at the till, and takes a payment later
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
create temp table mc_pos as select (r->>'id')::uuid id, (r->>'total')::numeric total
from public.create_invoice(jsonb_build_object('payment', 'credit', 'customer_name', 'زبون تجربة', 'customer_phone', '091-111-1111',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from t_part), 'qty', 4)))) r;
grant select on mc_pos to anon, authenticated;
select 'MC6 a credit sale under the merchant''s number (expect 60)' t, total from mc_pos;
select 'MC7 and a payment of 25 (expect 25.00)' t, r->>'paid_later' paid from public.add_customer_payment('p:911111111', 25, 'كاش') r;
reset role;

-- what the approved merchant should see: his received orders and invoices sent to him, every sale under his number, his payments
create temp table mc_want as
select (select coalesce(sum(greatest(total - paid, 0)), 0) from public.invoices i
        where i.status = 'done' and (i.customer_id = '55555555-5555-5555-5555-555555555555' or public.cust_key(i.customer_name, i.customer_phone) = 'p:911111111'))
     - (select coalesce(sum(amount), 0) from public.customer_payments where cust_key = 'p:911111111') as balance,
       (select count(*) from public.invoices i where (i.customer_id = '55555555-5555-5555-5555-555555555555' and (i.sent_at is not null or i.status in ('done', 'returned')))
          or (i.status in ('done', 'returned') and public.cust_key(i.customer_name, i.customer_phone) = 'p:911111111')) as n;
grant select on mc_want to authenticated;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'MC8 the approved merchant: the sale at the till is his, with his payment and what he owes (expect t, t, t, 1)' t,
       (r->>'balance')::numeric = (select balance from mc_want) bal_ok, jsonb_array_length(r->'invoices') = (select n from mc_want) n_ok,
       exists (select 1 from jsonb_array_elements(r->'invoices') x where (x->>'id')::uuid = (select id from mc_pos)) till_ok,
       (select count(*) from jsonb_array_elements(r->'payments') p where (p->>'amount')::numeric = 25) pay
from public.my_book() r;
select 'MC9 his orders are in it too (expect t)' t, jsonb_array_length(r->'orders') = (select count(*) from t_inv where customer_id = auth.uid() and source = 'app') ok from public.my_book() r;
select 'MC10 one of his invoices, with its lines (expect 60, 1 line, credit)' t, (r->>'total')::numeric total, jsonb_array_length(r->'items') lines, r->>'payment' pay
from public.my_bill((select id from mc_pos)) r;
reset role;

-- someone signs up with the approved merchant's number: he sees nothing of it
set role authenticated; select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
insert into public.customers (name, shop_name, phone) values ('منتحل', 'محل مزيف', '0911111111');
select 'MC11 the same number, not approved: none of the sales, no payments, no total (expect 0, 0, null)' t, jsonb_array_length(r->'invoices') inv,
       jsonb_array_length(r->'payments') pay, r->>'balance' bal from public.my_book() r;
select 'MC12 nor the invoice itself (expect t)' t, public.my_bill((select id from mc_pos)) is null as hidden;
reset role;

-- an approved merchant who changes his number needs the company's approval again
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
update public.customers set city = 'طرابلس';
select 'MC13 a new city keeps the approval (expect t)' t, approved from public.customers;
update public.customers set phone = '+218 91 111 1111';
select 'MC14 the same number written differently keeps it (expect t)' t, approved from public.customers;
update public.customers set phone = '0915550000';
select 'MC15 a new number loses it (expect f)' t, approved from public.customers;
reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.customers set phone = '0911111111', approved = true where user_id = '55555555-5555-5555-5555-555555555555';

-- sending invoices
set role anon; select set_config('request.jwt.claim.sub', '', false);
\echo MC16 expect not authorized (a visitor):
select public.send_invoice((select id from mc_pos));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
\echo MC17 expect not authorized (a merchant cannot send):
select public.send_invoice((select id from mc_pos));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo MC18 expect invoice not found (the seller may not open a sale the owner made at the till):
select public.send_invoice((select id from mc_pos), '88888888-8888-8888-8888-888888888888');
select 'MC19 the seller sends an app order to whoever ordered it (expect sent, same customer)' t, r->>'sent_at' is not null sent,
       (r->>'customer_id')::uuid = '55555555-5555-5555-5555-555555555555' same, r->'merchant'->>'shop_name' is not null has_merchant
from public.send_invoice((select id from t_inv where source = 'app' and customer_id = '55555555-5555-5555-5555-555555555555' and status in ('preparing', 'ready', 'done') order by no limit 1)) r;
\echo MC20 expect invoice cancelled:
select public.send_invoice((select id from t_inv where source = 'app' and status = 'cancelled' order by no limit 1));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
create temp table mc_pos2 as select (r->>'id')::uuid id
from public.create_invoice(jsonb_build_object('payment', 'cash', 'customer_name', 'محل الأمل', 'customer_phone', '0912223344',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from t_part), 'qty', 2)))) r;
grant select on mc_pos2 to authenticated;
\echo MC21 expect choose the merchant (a sale at the till names no account):
select public.send_invoice((select id from mc_pos2));
\echo MC22 expect merchant not found:
select public.send_invoice((select id from mc_pos2), '66666666-6666-6666-6666-666666666666');
select 'MC23 sent to the new merchant (expect his id, his shop)' t, (r->>'customer_id')::uuid = '88888888-8888-8888-8888-888888888888' linked, r->'merchant'->>'shop_name' shop
from public.send_invoice((select id from mc_pos2), '88888888-8888-8888-8888-888888888888') r;
\echo MC24 expect invoice belongs to another merchant:
select public.send_invoice((select id from mc_pos2), '55555555-5555-5555-5555-555555555555');
select 'MC25 sending again is fine (expect t)' t, (r->>'sent_at') is not null again from public.send_invoice((select id from mc_pos2)) r;
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
select 'MC26 the new merchant has it before approval, but no total (expect 1, null)' t, jsonb_array_length(r->'invoices') inv, r->>'balance' bal from public.my_book() r;
select 'MC27 he opens it (expect 30, 2)' t, (r->>'total')::numeric total, (r->'items'->0->>'qty')::integer qty from public.my_bill((select id from mc_pos2)) r;
select 'MC28 and it is on his notices (expect 1)' t, jsonb_array_length(public.my_inbox()) n;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'MC29 nobody else opens it (expect t)' t, public.my_bill((select id from mc_pos2)) is null as hidden;
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'MC30 taken back: no longer his (expect no account, not sent)' t, r->>'customer_id' is null unlinked, r->>'sent_at' is null unsent from public.unsend_invoice((select id from mc_pos2)) r;
\echo MC31 expect invoice not sent:
select public.unsend_invoice((select id from mc_pos2));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
select 'MC32 gone from his account and his notices (expect 0, 0)' t, jsonb_array_length(r->'invoices') inv, jsonb_array_length(public.my_inbox()) n from public.my_book() r;
-- an order with no name: the invoice carries the shop's name
select 'MC33 an order names his shop (expect محل الأمل لقطع الغيار)' t, r->>'customer_name' name
from public.place_order(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from t_part), 'qty', 1)))) r;
select 'MC34 his order is in his الصادر, not yet an invoice (expect 1, 0)' t, jsonb_array_length(r->'orders') ord, jsonb_array_length(r->'invoices') inv from public.my_book() r;
reset role;

-- finding merchants and the merchants page
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'MC35 the seller finds a merchant by part of his number (expect محل الأمل لقطع الغيار)' t, r->0->>'shop_name' shop from public.find_merchants('2223344') r;
select 'MC36 and by his shop, spelled loosely (expect 1)' t, jsonb_array_length(public.find_merchants('الامل')) n;
\echo MC37 expect not authorized (the merchants page needs customers, invoices or reports):
select public.list_merchants();
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
\echo MC38 expect not authorized (a merchant cannot look for others):
select public.find_merchants('محل');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'MC39 the merchants page (expect 3 merchants, 2 waiting for approval, the open order first)' t, (r->'counts'->>'all')::integer n, (r->'counts'->>'pending')::integer pending,
       r->'items'->0->>'shop_name' first from public.list_merchants() r;
select 'MC40 waiting for approval (expect 2)' t, (r->>'total')::integer n from public.list_merchants(null, 'pending') r;
select 'MC41 one merchant, as the owner sees him (expect his key, the same total he sees)' t, r->>'key' k, (r->>'balance')::numeric = (select balance from mc_want) same
from public.merchant_detail('55555555-5555-5555-5555-555555555555') r;
reset role;

-- a new password from the owner
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo MC42 expect not authorized (only the owner):
select public.set_customer_password('99999999-9999-9999-9999-999999999999', '654321');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
\echo MC43 expect bad password:
select public.set_customer_password('99999999-9999-9999-9999-999999999999', '12');
\echo MC44 expect merchant not found (the account of a seller is not a merchant):
select public.set_customer_password('77777777-7777-7777-7777-777777777777', '654321');
select public.set_customer_password('99999999-9999-9999-9999-999999999999', '654321');
reset role;
select 'MC45 the new password works (expect t, f)' t, encrypted_password = extensions.crypt('654321', encrypted_password) ok,
       encrypted_password = extensions.crypt('123456', encrypted_password) wrong
from auth.users where id = '99999999-9999-9999-9999-999999999999';
select 'MC46 the activity log (expect customer_password, invoice_sent, invoice_unsent)' t, string_agg(distinct kind, ', ' order by kind) kinds
from public.activity_log where kind in ('invoice_sent', 'invoice_unsent', 'customer_password');
select 'MC47 the log names the shop (expect محل الأمل لقطع الغيار)' t, title from public.activity_log where kind = 'invoice_sent' order by id desc limit 1;

-- a forgotten password by SMS: a phone account carries its number on the account
set role authenticated; select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
select 'MC48 a phone account takes its number from its sign-in (expect t)' t, public.link_login_phone() linked;
reset role;
select 'MC49 (expect 218911111111, t)' t, phone, phone_confirmed_at is not null confirmed from auth.users where id = '99999999-9999-9999-9999-999999999999';
set role authenticated; select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
select 'MC50 an email account has no number to take (expect f)' t, public.link_login_phone() linked;
reset role;

-- the System tab's «الرصيد الكلي»: the money in and out in the profit report (pnl_report cash_in / cash_out)
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'MC51 money in = paid at the sale + customers'' payments; out = purchases paid + supplier payments + expenses + refunds (expect t, t)' t,
  (r->>'cash_in')::numeric = (select coalesce(sum(paid), 0) from public.invoices where status = 'done' and created_at >= now() - interval '1 day')
                           + (select coalesce(sum(amount), 0) from public.customer_payments where created_at >= now() - interval '1 day') in_ok,
  (r->>'cash_out')::numeric = (select coalesce(sum(coalesce(paid, total)), 0) from public.purchases where created_at >= now() - interval '1 day')
                            + (select coalesce(sum(amount), 0) from public.supplier_payments where created_at >= now() - interval '1 day')
                            + (select coalesce(sum(amount), 0) from public.expenses where spent_on >= (now() - interval '1 day')::date and spent_on < (now() + interval '1 day')::date)
                            + (select coalesce(sum(paid), 0) from public.invoices where status = 'returned' and returned_at >= now() - interval '1 day') out_ok
from public.pnl_report(now() - interval '1 day', now() + interval '1 day') r;
reset role;

-- the merchants' shops on the home screen (section 17)
update public.settings set open_shops = false where id = 1;
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'MC52 no shop shows before the company shows it (expect 0)' t, count(*) from public.merchant_shops();
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
update public.customers set shop_on = true, phone_public = true where user_id = '88888888-8888-8888-8888-888888888888';
reset role;
select 'MC53 a merchant cannot show his own shop, but may show his phone (expect f, t)' t, shop_on, phone_public from public.customers where user_id = '88888888-8888-8888-8888-888888888888';
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.customers set shop_on = true where user_id = '88888888-8888-8888-8888-888888888888';
select 'MC54 the owner shows it (expect t t f)' t, (r->>'shop_on')::boolean shop_on, (r->>'shop_shown')::boolean shown, (r->>'phone_public') is null missing
from public.merchant_detail('88888888-8888-8888-8888-888888888888') r;
reset role;
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'MC55 anyone sees it: the name, the city and the phone he shows (expect 1, محل الأمل لقطع الغيار, مصراتة, t)' t, count(*) over () n, r->>'name' name, r->>'city' city, r->>'phone' is not null phone
from public.merchant_shops() r;
select 'MC56 one shop by its id, and the search (expect محل الأمل لقطع الغيار, 1, 0)' t, public.merchant_shop('88888888-8888-8888-8888-888888888888')->>'name' name,
  (select count(*) from public.merchant_shops('مصراته')) by_city, (select count(*) from public.merchant_shops('ما فيش')) none;
reset role;
update public.customers set phone_public = false where user_id = '88888888-8888-8888-8888-888888888888';
select 'MC57 a hidden phone stays hidden (expect t)' t, public.merchant_shop('88888888-8888-8888-8888-888888888888')->>'phone' is null hidden;
update public.settings set open_shops = true where id = 1;
select 'MC58 «anyone may register a shop»: every merchant with a shop''s name shows, no staff, no owner (expect t, f, f)' t,
  (select count(*) from public.merchant_shops()) = (select count(*) from public.customers c where btrim(c.shop_name) <> ''
      and not exists (select 1 from public.staff s where s.user_id = c.user_id) and not exists (select 1 from public.admins a where a.user_id = c.user_id)) all_shown,
  exists (select 1 from public.merchant_shops() r, public.staff s where s.user_id = (r->>'id')::uuid) staff_shown,
  exists (select 1 from public.merchant_shops() r, public.admins a where a.user_id = (r->>'id')::uuid) owner_shown;
update public.settings set open_shops = false where id = 1;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.customers set shop_on = false where user_id = '88888888-8888-8888-8888-888888888888';
reset role;
select 'MC59 hidden again: no page for it either (expect t)' t, public.merchant_shop('88888888-8888-8888-8888-888888888888') is null gone;
