\pset footer off
-- Accounts: stock, customers and suppliers with their debts, expenses, profit and loss. Run after receive_tests.sql.
-- 11111111 = owner/admin, 66666666 = signed-in user who is not staff, 77777777 = staff (permissions set below)
insert into public.products (shop_id, owner_id, title, cat, cond, price, qty, cost, sku)
select s.id, s.owner_id, 'Books test item', 'other', 'original', 100, 10, 60, 'BK-1' from public.shops s where s.owner_id = '11111111-1111-1111-1111-111111111111' order by s.created_at limit 1;

set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo B1 expect not authorized (outsider, stock):
select public.stock_report();
\echo B2 expect not authorized (outsider, profit and loss):
select public.pnl_report(now() - interval '1 day', now() + interval '1 day');
reset role;

-- stock: report, damaged, below zero, count
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'B3 stock report finds BK-1 (qty 10, cost 60) and values the stock' t, r->'items'->0->>'qty' qty, r->'items'->0->>'cost' cost, (r->'summary'->>'value_cost')::numeric > 0 valued, r->>'total' found
from public.stock_report('bk-1') r;
select 'B4 damaged -2 (expect qty 8, delta -2)' t, r->>'qty' qty, r->>'delta' delta
from public.adjust_stock(jsonb_build_object('id', (select id from public.products where sku = 'BK-1'), 'delta', -2, 'reason', 'damaged', 'note', 'كسر في النقل')) r;
\echo B5 expect stock cannot go below zero (available 8):
select public.adjust_stock(jsonb_build_object('id', (select id from public.products where sku = 'BK-1'), 'delta', -9, 'reason', 'lost'));
select 'B6 count sets 9 (expect delta 1)' t, r->>'qty' qty, r->>'delta' delta
from public.adjust_stock(jsonb_build_object('id', (select id from public.products where sku = 'BK-1'), 'set', 9, 'reason', 'count')) r;
\echo B7 expect nothing to change:
select public.adjust_stock(jsonb_build_object('id', (select id from public.products where sku = 'BK-1'), 'set', 9, 'reason', 'count'));
select 'B8 moves kept with their cost (expect -2:damaged:-120, 1:count:60) and listed' t,
  (select string_agg(qty || ':' || reason || ':' || (qty * cost)::integer, ', ' order by id) from public.stock_moves where title = 'Books test item') moves,
  jsonb_array_length(r->'moves') listed
from public.stock_report() r;

-- customers: the same phone written two ways is one customer; then a payment
select 'B9 credit sale 3 x 100, paid 100' t, (r->>'total')::numeric total, (r->>'paid')::numeric paid
from public.create_invoice(jsonb_build_object('payment', 'credit', 'paid', 100, 'customer_name', 'ورشة الاختبار', 'customer_phone', '091-234-5678',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'BK-1'), 'qty', 3)))) r;
select 'B10 second credit sale, phone with the country code' t, (r->>'total')::numeric total
from public.create_invoice(jsonb_build_object('payment', 'credit', 'customer_name', 'ورشة الإختبار', 'customer_phone', '+218 91 234 5678',
  'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'BK-1'), 'qty', 1)))) r;
select 'B11 one customer, 2 invoices, owes 300' t, r->>'total' customers, r->'items'->0->>'key' k, r->'items'->0->>'count' n, (r->'items'->0->>'balance')::numeric bal
from public.list_buyers('الاختبار') r;
select 'B11b found by phone digits too' t, r->>'total' customers from public.list_buyers('0912345678') r;
select 'B12 pays 120 (expect balance 180, 1 payment)' t, (r->>'balance')::numeric bal, jsonb_array_length(r->'payments') pays
from public.add_customer_payment('p:912345678', 120, 'كاش') r;
\echo B13 expect bad amount:
select public.add_customer_payment('p:912345678', 0);
\echo B14 expect customer not found:
select public.add_customer_payment('p:000000000', 5);
select 'B15 owing filter and total owed' t, r->>'total' owing, (r->>'owing_total')::numeric >= 180 total_ok from public.list_buyers(null, true) r;

-- suppliers: a receipt half on credit
select 'B16 receive on credit: 5 x 60 = 300, paid 100' t, r->>'total' total
from public.receive_stock(jsonb_build_object('supplier', 'مؤسسة الاختبار', 'paid', 100, 'items', jsonb_build_array(jsonb_build_object('sku', 'BK-1', 'qty', 5, 'cost', 60)))) r;
\echo B17 expect supplier needed for credit:
select public.receive_stock(jsonb_build_object('paid', 0, 'items', jsonb_build_array(jsonb_build_object('sku', 'BK-1', 'qty', 1, 'cost', 60))));
select 'B18 supplier owed 200, spelling does not matter' t, r->>'total' found, (r->'items'->0->>'balance')::numeric bal from public.list_suppliers('موسسة الاختبار') r;
select 'B19 pay the supplier 50 (expect balance 150)' t, (r->>'balance')::numeric bal, jsonb_array_length(r->'receipts') receipts
from public.add_supplier_payment(public.sup_key('مؤسسة الاختبار'), 50) r;
select 'B20 receipts list shows what was paid' t, r->>'total' total, r->>'paid' paid from public.list_purchases(1) r;

-- expenses
select 'B21 rent 500' t, r->>'cat' cat, (r->>'amount')::numeric amount from public.add_expense('{"cat":"rent","amount":"500","note":"إيجار المحل"}'::jsonb) r;
select 'B22 an unknown type is saved as other' t, r->>'cat' cat from public.add_expense('{"cat":"party","amount":20}'::jsonb) r;
\echo B23 expect bad amount:
select public.add_expense('{"cat":"rent","amount":-5}'::jsonb);
select 'B24 expenses in the period: 2, sum 520' t, r->>'total' n, (r->>'sum')::numeric total, r->'by_cat'->>'rent' rent from public.list_expenses(current_date - 1, current_date + 2) r;

-- profit and loss
select 'B25 P&L: expenses 520, stock -60, net adds up, owed to suppliers 150, customers owe >= 180' t,
  (r->>'expenses')::numeric exp, (r->>'stock_adj')::numeric stock,
  (r->>'net')::numeric = (r->>'sales')::numeric - (r->>'cogs')::numeric - 520 - 60 adds_up, (r->>'payable')::numeric payable, (r->>'receivable')::numeric >= 180 recv,
  jsonb_array_length(r->'by_staff') > 0 sellers
from public.pnl_report(now() - interval '1 day', now() + interval '1 day') r;
select 'B26 the BK-1 sales are in: sales - cogs includes 4 x (100 - 60)' t, (r->>'gross')::numeric >= 160 gross_ok from public.pnl_report(now() - interval '1 day', now() + interval '1 day') r;
reset role;

-- staff permissions
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'B27 staff gets sales + expenses' t, r->'perms' perms from public.save_staff('seller@test.local', 'بائع', array['sales', 'expenses'], null, true) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo B28 expect not authorized (no products permission):
select public.adjust_stock(jsonb_build_object('id', (select id from public.products where sku = 'BK-1'), 'delta', -1, 'reason', 'lost'));
\echo B29 expect not authorized (the customers list needs the invoices permission):
select public.list_buyers();
\echo B30 expect not authorized (profit and loss needs the costs permission):
select public.pnl_report(now() - interval '1 day', now() + interval '1 day');
\echo B31 expect not authorized (suppliers need the costs permission):
select public.list_suppliers();
select 'B32 staff records an expense' t, r->>'cat' cat, r->>'staff_name' who from public.add_expense('{"cat":"transport","amount":35}'::jsonb) r;
\echo B33 expect not authorized (cannot delete an expense of the owner):
select public.delete_expense((select id from public.expenses where cat = 'rent' order by id desc limit 1));
\echo B34 deletes own expense (no error):
select public.delete_expense((select id from public.expenses where cat = 'transport' order by id desc limit 1));
reset role;
select 'B35 transport expense gone, rent kept' t, count(*) filter (where cat = 'transport') transport, count(*) filter (where cat = 'rent') rent from public.expenses;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
\echo B36 owner deletes the customer payment (no error):
select public.delete_customer_payment((select id from public.customer_payments order by id desc limit 1));
select 'B37 balance back to 300' t, (r->>'balance')::numeric bal from public.buyer_detail('p:912345678') r;
reset role;
