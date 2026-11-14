\pset footer off
-- Owner controls: the activity log, staff limits, selling below cost, hiding from customers, bulk prices, taking a receipt back.
-- Run after books_tests.sql. 11111111 = owner/admin, 66666666 = signed-in user who is not staff, 77777777 = staff (seller@test.local)
select set_config('sparat.ctx', 'fixture', false);
insert into public.products (shop_id, owner_id, title, cat, cond, make, price, qty, cost, sku)
select s.id, s.owner_id, x.title, x.cat, 'original', x.make, x.price, x.qty, x.cost, x.sku
from (select id, owner_id from public.shops where owner_id = '11111111-1111-1111-1111-111111111111' order by created_at limit 1) s,
     (values ('فحمات كيا', 'brakes', 'kia', 100, 20, 70, 'KT-1'), ('ديسكات كيا', 'brakes', 'kia', 50, 5, 30, 'KT-2'),
             ('طرمبة تويوتا', 'engine', 'toyota', 200, 4, 150, 'KT-3')) x(title, cat, make, price, qty, cost, sku);
select set_config('sparat.ctx', '', false);

-- the log is the owner's alone, and nobody writes to it by hand
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo K1 expect not authorized (outsider reads the log):
select public.list_activity();
select 'K2 outsider sees no log lines' t, count(*) n from public.activity_log;
\echo K3 expect permission denied (write to the log):
insert into public.activity_log (kind, title) values ('sale', 'fake');
\echo K4 expect permission denied (the log writer is not for the app):
select public.log_act('sale', '', 'fake');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo K5 expect not authorized (staff reads the log):
select public.list_activity();
reset role;

-- what the owner does is written down, once per action
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.products set price = 110 where sku = 'KT-1';
select 'K6 price edited by hand: one line with old and new (expect product_edit, [100, 110])' t, a.kind, a.detail->'price' price, a.actor_id = '11111111-1111-1111-1111-111111111111' by_owner
from public.activity_log a where a.title = 'فحمات كيا' order by a.id desc limit 1;
select 'K7a sale of 2' t, (r->>'total')::numeric total
from public.create_invoice(jsonb_build_object('customer_name', 'زبون السجل', 'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-1'), 'qty', 2)))) r;
select 'K7 one sale line, no extra stock line for the part (expect sale 220 2 units, edits 1)' t, a.kind, a.amount, a.detail->>'units' units,
  (select count(*) from public.activity_log where kind = 'product_edit' and title = 'فحمات كيا') edits
from public.activity_log a where a.kind = 'sale' and a.title = 'زبون السجل';
update public.products set qty = 30 where sku = 'KT-1';
select 'K8 quantity edited by hand is written down (expect [18, 30])' t, detail->'qty' qty from public.activity_log where kind = 'product_edit' and title = 'فحمات كيا' order by id desc limit 1;
select 'K9 staff gets sales, discounts, prices and purchases, at most 5% off' t, r->>'max_discount' max_discount
from public.save_staff('seller@test.local', 'بائع', array['sales', 'discounts', 'prices', 'purchases'], null, true, 5) r;
select 'K10 the change is in the log with what it was (expect staff, 5, was null)' t, kind, detail->>'max_discount' now, detail->'was'->>'max_discount' was
from public.activity_log where kind = 'staff' order by id desc limit 1;
\echo K11 expect bad discount limit:
select public.save_staff('seller@test.local', 'بائع', array['sales'], null, true, 120);
reset role;

-- the discount limit counts everything taken off the list price
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'K12 staff sees the limit' t, public.my_perms()->>'max_discount' max_discount;
\echo K13 expect discount over limit: 5.00 (10 off 110):
select public.create_invoice(jsonb_build_object('discount', 10, 'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-1'), 'qty', 1))));
select 'K14 5 off 110 is within the limit' t, (r->>'total')::numeric total
from public.create_invoice(jsonb_build_object('discount', 5, 'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-1'), 'qty', 1)))) r;
\echo K15 expect discount over limit: 5.00 (a lower price counts too):
select public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-1'), 'qty', 1, 'price', 100))));
select 'K16 a price 5 below the list is within the limit' t, (r->>'total')::numeric total
from public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-1'), 'qty', 1, 'price', 105)))) r;
reset role;

-- no selling below cost (for the staff)
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.settings set no_below_cost = true where id = 1;
select 'K17 the setting change is in the log' t, kind, title, detail->'changes'->'no_below_cost' change from public.activity_log where kind = 'settings' order by id desc limit 1;
select 'K18 limit lifted for the next tests' t, r->>'max_discount' max_discount from public.save_staff('seller@test.local', 'بائع', array['sales', 'discounts', 'prices', 'purchases'], null, true, null) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo K19 expect below cost: ديسكات كيا (price 25, cost 30):
select public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-2'), 'qty', 1, 'price', 25))));
\echo K20 expect below cost (a discount that takes the invoice under the cost):
select public.create_invoice(jsonb_build_object('discount', 25, 'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-2'), 'qty', 1))));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'K21 the owner may sell below cost (expect 25)' t, (r->>'total')::numeric total
from public.create_invoice(jsonb_build_object('discount', 25, 'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-2'), 'qty', 1)))) r;
update public.settings set no_below_cost = false, hide_qty = true, low_stock = 5 where id = 1;
reset role;

-- hidden quantities and the running-low level (customers cannot read the parts table, so the id is taken first)
select id as kt1 from public.products where sku = 'KT-1' \gset
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'K22 customers do not see the quantity' t, r->>'qty' qty, r->>'title' title from public.search_products(p_ids => array[:'kt1'::uuid]) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'K23 staff still see it (expect 28)' t, r->>'qty' qty from public.search_products(p_ids => array[:'kt1'::uuid]) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'K24 running low means 5 or less now (expect level 5; KT-2 and KT-3 are low)' t, r->'summary'->>'low_level' level,
  (select string_agg(x->>'sku', ',' order by x->>'sku') from jsonb_array_elements(r->'items') x) low
from public.stock_report('KT-', 'low') r;
update public.settings set hide_qty = false where id = 1;

-- prices in bulk: try first, then change, then put back
select 'K25 try +10% on the KIA brakes, rounded up to 5 (expect 2 to change: 110 to 125, 50 to 55)' t, r->>'count' n,
  (select string_agg((x->>'old')::numeric::integer || '>' || (x->>'new')::numeric::integer, ', ' order by x->>'title') from jsonb_array_elements(r->'sample') x) sample
from public.bulk_price('{"mode":"pct","value":10,"round":5,"cat":"brakes","q":"KT-","dry":true}'::jsonb) r;
select 'K26 nothing changed yet (expect 110)' t, price from public.products where sku = 'KT-1';
\echo K27 expect bad value:
select public.bulk_price('{"mode":"pct","value":0}'::jsonb);
\echo K28 expect bad rounding:
select public.bulk_price('{"mode":"pct","value":5,"round":3}'::jsonb);
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo K29 expect not authorized (staff changes prices in bulk):
select public.bulk_price('{"mode":"pct","value":10}'::jsonb);
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'K30 change them (expect 2)' t, r->>'count' n from public.bulk_price('{"mode":"pct","value":10,"round":5,"cat":"brakes","q":"KT-"}'::jsonb) r;
select 'K31 new prices, one log line, no line per part (expect 125, 55, bulk lines 1, edits 0)' t,
  (select price from public.products where sku = 'KT-1') kt1, (select price from public.products where sku = 'KT-2') kt2,
  (select count(*) from public.activity_log where kind = 'bulk_price') bulk,
  (select count(*) from public.activity_log where kind = 'product_edit' and detail ? 'price' and title in ('فحمات كيا', 'ديسكات كيا') and detail->'price'->>1 in ('125', '125.00', '55', '55.00')) edits;
update public.products set price = 60 where sku = 'KT-2';
select 'K32 the last change can be put back' t, jsonb_array_length(public.price_batches()) batches, public.price_batches()->0->>'count' parts;
select 'K33 put back (expect 1 put back, 1 kept)' t, r->>'count' n, r->>'kept' kept from public.undo_bulk_price((public.price_batches()->0->>'batch')::bigint) r;
select 'K33b KT-1 back to 110, KT-2 keeps the 60 set by hand, nothing left to put back' t,
  (select price from public.products where sku = 'KT-1') kt1, (select price from public.products where sku = 'KT-2') kt2, jsonb_array_length(public.price_batches()) batches;
\echo K34 expect nothing to undo:
select public.undo_bulk_price((select max(ref::bigint) from public.activity_log where kind = 'bulk_price'));
select 'K35 cost + 50% for KT-3 (expect 1)' t, r->>'count' n from public.bulk_price('{"mode":"margin","value":50,"q":"KT-3"}'::jsonb) r;
select 'K35b (expect 225)' t, price from public.products where sku = 'KT-3';
reset role;

-- taking a receipt back
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'K36 staff receives KT-3 x2 at a new cost 160 and a new part x3' t, r->>'updated' upd, r->>'new' new
from public.receive_stock(jsonb_build_object('supplier', 'مورد التراجع', 'source', 'photo', 'auto', true, 'items', jsonb_build_array(
  jsonb_build_object('sku', 'KT-3', 'qty', 2, 'cost', 160), jsonb_build_object('part_no', 'NEW-9', 'title', 'حساس تجربة', 'qty', 3, 'cost', 40)))) r;
select 'K37 stock and cost moved (expect 6, 160, new part 3)' t, (select qty from public.products where sku = 'KT-3') qty, (select cost from public.products where sku = 'KT-3') cost,
  (select qty from public.products where part_no = 'NEW-9') new_part;
select 'K38 staff takes it back (expect 2 parts, 1 removed)' t, r->>'parts' parts, r->>'removed' removed
from public.undo_receipt((select id from public.purchases where supplier = 'مورد التراجع')) r;
reset role;
select 'K39 all back: qty 4, cost 150, the new part gone, the receipt gone' t, (select qty from public.products where sku = 'KT-3') qty, (select cost from public.products where sku = 'KT-3') cost,
  (select count(*) from public.products where part_no = 'NEW-9') new_part, (select count(*) from public.purchases where supplier = 'مورد التراجع') receipts;
select 'K40 the log keeps both, the receipt said it came from a photo (expect receive photo true, receipt_undo with 2 lines)' t,
  (select detail->>'source' || ' ' || (detail->>'auto') from public.activity_log where kind = 'receive' and title = 'مورد التراجع') receive,
  (select jsonb_array_length(detail->'lines') from public.activity_log where kind = 'receipt_undo' and title = 'مورد التراجع') undo_lines;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'K41 owner receives KT-1 x2' t, r->>'updated' upd from public.receive_stock(jsonb_build_object('supplier', 'مورد المالك', 'items', jsonb_build_array(jsonb_build_object('sku', 'KT-1', 'qty', 2)))) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo K42 expect not authorized (staff takes back a receipt of the owner):
select public.undo_receipt((select id from public.purchases where supplier = 'مورد المالك'));
select 'K43 staff receives KT-2 x1' t, r->>'updated' upd from public.receive_stock(jsonb_build_object('supplier', 'مورد البيع', 'items', jsonb_build_array(jsonb_build_object('sku', 'KT-2', 'qty', 1)))) r;
select 'K44 staff sells all of KT-2' t, (r->>'total')::numeric > 0 sold
from public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-2'), 'qty', (select qty from public.products where sku = 'KT-2'))))) r;
\echo K45 expect already sold: ديسكات كيا:
select public.undo_receipt((select id from public.purchases where supplier = 'مورد البيع'));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'K46 the owner takes back a receipt (expect 1)' t, r->>'parts' parts from public.undo_receipt((select id from public.purchases where supplier = 'مورد المالك')) r;
select 'K46b KT-1 back to 28' t, qty from public.products where sku = 'KT-1';

-- money, customers and returns are written down too
select 'K47 an expense and its deletion' t, (public.add_expense('{"cat":"other","amount":12,"note":"سجل"}'::jsonb))->>'amount' amount;
select public.delete_expense((select id from public.expenses where note = 'سجل'));
select 'K48 (expect expense 12, expense_del 12)' t, string_agg(kind || ' ' || amount::integer, ', ' order by id) lines from public.activity_log where kind like 'expense%' and amount = 12;
update public.customers set approved = false where user_id = '55555555-5555-5555-5555-555555555555';
update public.customers set approved = true where user_id = '55555555-5555-5555-5555-555555555555';
select 'K49 a customer stopped and approved again (expect false,true)' t, string_agg(a, ',' order by id) lines
from (select id, detail->>'approved' a from public.activity_log where kind = 'customer' order by id desc limit 2) x;
select 'K50 a return' t, r->>'status' status from public.return_invoice((select (ref)::uuid from public.activity_log where kind = 'sale' and title = 'زبون السجل')) r;
select 'K51 return written with the invoice number' t, kind, (detail->>'no') is not null has_no from public.activity_log where kind = 'return' order by id desc limit 1;

-- reading the log
select 'K52 groups: sales lines are sales and returns only' t, (r->>'total')::integer >= 6 enough,
  (select bool_and(x->>'kind' in ('sale', 'return')) from jsonb_array_elements(r->'items') x) only_sales
from public.list_activity('sales') r;
select 'K53 prices group has the bulk change, its undo and the hand edits' t,
  (select string_agg(distinct x->>'kind', ',') from jsonb_array_elements(r->'items') x) kinds
from public.list_activity('prices') r;
select 'K54 one person: everything the staff member did, and both people listed' t,
  (select bool_and(x->>'actor_id' = '77777777-7777-7777-7777-777777777777') from jsonb_array_elements(r->'items') x) only_staff,
  jsonb_array_length(r->'actors') >= 2 people
from public.list_activity(p_actor => '77777777-7777-7777-7777-777777777777') r;
select 'K55 a word finds the supplier' t, (r->>'total')::integer receipts from public.list_activity(p_q => 'مورد التراجع') r;
-- a logo picture per brand
update public.settings set brand_logos = '{"kia": "https://example.test/storage/v1/object/public/photos/u/kia.jpg"}'::jsonb where id = 1;
select 'K58 brand logos saved; the log names the setting without copying the pictures (expect kia, brand_logos, no change values)' t,
  (select string_agg(k, ',') from jsonb_object_keys((select brand_logos from public.settings where id = 1)) k) brands,
  (select title from public.activity_log where kind = 'settings' order by id desc limit 1) setting,
  (select detail->'changes' ? 'brand_logos' from public.activity_log where kind = 'settings' order by id desc limit 1) copied;
\echo K59 expect violates check constraint (a list is not a map of brands):
update public.settings set brand_logos = '["kia"]'::jsonb where id = 1;
\echo K56 expect permission denied (the owner cannot rewrite the log either):
update public.activity_log set title = 'x';
\echo K57 expect permission denied (nor delete it):
delete from public.activity_log;
reset role;
