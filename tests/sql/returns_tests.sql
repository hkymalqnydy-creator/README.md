\pset footer off
-- Some of the parts back from a sale (return_items, supabase/setup.sql next to return_invoice), and an app order sent with what
-- was on the shelf (pick_done with p_avail, section 18). Run after warehouse_tests.sql. 11111111 = owner, 77777777 = a seller
-- without returns, 44444444 = the warehouse employee (يوسف), 88888888 = a customer (سالم).
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
create temp table r_stock as select sku, qty from public.products where sku in ('POS-1', 'STK-50', 'KT-1', 'ORD-H', 'BK-1');
grant select on r_stock to authenticated;
-- a cash sale: 3 × 55 + 2 × 20 = 205, 5 off = 200
create temp table r_cash as select (r->>'id')::uuid id, (r->>'no') no from public.create_invoice(jsonb_build_object('payment', 'cash', 'discount', 5,
  'customer_name', 'محل الريان', 'customer_phone', '0911112222', 'items', jsonb_build_array(
    jsonb_build_object('id', (select id from public.products where sku = 'POS-1'), 'qty', 3),
    jsonb_build_object('id', (select id from public.products where sku = 'STK-50'), 'qty', 2)))) r;
grant select on r_cash to authenticated;
create temp table r_line as select it.id, p.sku from public.invoice_items it join public.products p on p.id = it.product_id where it.invoice_id = (select id from r_cash);
grant select on r_line to authenticated;
select 'R1 one of three back: the discount shrinks with it, the difference paid back (expect done, 150.00, 3.66, 146.34, 146.34, 53.66)' t,
  r->>'status' status, r->>'subtotal' sub, r->>'discount' disc, r->>'total' total, r->>'paid' paid, r->>'refunded' refunded
from public.return_items((select id from r_cash), jsonb_build_array(jsonb_build_object('id', (select id from r_line where sku = 'POS-1'), 'qty', 1)), 'تالفة') r;
reset role;
select 'R2 the line keeps what stays sold, the part back in stock (expect 2, 1, 110.00, t)' t, it.qty, it.returned, it.line_total,
  (select qty from public.products where sku = 'POS-1') = (select qty from r_stock where sku = 'POS-1') - 2 stock_ok
from public.invoice_items it where it.id = (select id from r_line where sku = 'POS-1');
select 'R3 the return written down (expect 53.66, 53.66, تالفة, 1, محل الريان)' t, amount, refund, reason, jsonb_array_length(lines) n,
  (select title from public.activity_log where kind = 'return_part' and ref = (select id::text from r_cash)) logged
from public.invoice_returns where invoice_id = (select id from r_cash);
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'R4 the invoice shows it (expect 1, 53.66, 1)' t, jsonb_array_length(r->'returns') n, r->'returns'->0->>'refund' refund,
  (select (x->>'returned')::integer from jsonb_array_elements(r->'items') x where (x->>'id')::bigint = (select id from r_line where sku = 'POS-1')) returned
from public.get_invoice((select id from r_cash)) r;
select 'R5 the invoices list counts it (expect 1)' t, r->>'returned_units' n from public.list_invoices(p_q => (select no from r_cash)) r where r->>'id' = (select id::text from r_cash);
\echo R6 expect bad quantity (more than is left on the line):
select public.return_items((select id from r_cash), jsonb_build_array(jsonb_build_object('id', (select id from r_line where sku = 'POS-1'), 'qty', 3)));
\echo R7 expect pick the parts to return:
select public.return_items((select id from r_cash), '[]'::jsonb);
\echo R8 expect line not on this invoice:
select public.return_items((select id from r_cash), jsonb_build_array(jsonb_build_object('id', 1, 'qty', 1)));
-- on credit: 2 × 110 = 220, 50 paid; one back owes less, nothing paid back
create temp table r_credit as select (r->>'id')::uuid id from public.create_invoice(jsonb_build_object('payment', 'credit', 'paid', 50,
  'customer_name', 'ورشة الأمل', 'customer_phone', '0913334444', 'items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'KT-1'), 'qty', 2)))) r;
grant select on r_credit to authenticated;
select 'R9 on credit: owes less, nothing paid back (expect 110.00, 50.00, 0.00, 60.00)' t, r->>'total' total, r->>'paid' paid, r->>'refunded' refunded, (r->>'total')::numeric - (r->>'paid')::numeric owes
from public.return_items((select id from r_credit), jsonb_build_array(jsonb_build_object('id', (select id from public.invoice_items where invoice_id = (select id from r_credit)), 'qty', 1))) r;
select 'R10 what is left coming back is the whole invoice (expect returned)' t, r->>'status' status
from public.return_items((select id from r_credit), jsonb_build_array(jsonb_build_object('id', (select id from public.invoice_items where invoice_id = (select id from r_credit)), 'qty', 1))) r;
select 'R10b every part back in stock (expect t)' t, (select qty from public.products where sku = 'KT-1') = (select qty from r_stock where sku = 'KT-1') stock_back;
create temp table r_rep as select (select r from public.sales_report(now() - interval '1 day', now() + interval '1 day') r) sales,
                                  (select r from public.pnl_report(now() - interval '1 day', now() + interval '1 day') r) pnl;
reset role;
-- (the returns are read through the reports; the table itself is closed to the app)
select 'R11 the day''s report counts both returns (expect t)' t,
  (sales->>'returned')::integer = (select count(*) from public.invoices where status = 'returned' and returned_at >= now() - interval '1 day')
                                + (select count(*) from public.invoice_returns where created_at >= now() - interval '1 day') same
from r_rep;
select 'R12 money in at the sale, the refund out on the day of the return (expect t, t)' t,
  (pnl->>'cash_in')::numeric = (select coalesce(sum(paid + refunded), 0) from public.invoices where status in ('done', 'returned') and created_at >= now() - interval '1 day')
                             + (select coalesce(sum(amount), 0) from public.customer_payments where created_at >= now() - interval '1 day') in_ok,
  (pnl->>'cash_out')::numeric = (select coalesce(sum(coalesce(paid, total)), 0) from public.purchases where created_at >= now() - interval '1 day')
                              + (select coalesce(sum(amount), 0) from public.supplier_payments where created_at >= now() - interval '1 day')
                              + (select coalesce(sum(amount), 0) from public.expenses where spent_on >= (now() - interval '1 day')::date and spent_on < (now() + interval '1 day')::date)
                              + (select coalesce(sum(paid), 0) from public.invoices where status = 'returned' and returned_at >= now() - interval '1 day')
                              + (select coalesce(sum(refund), 0) from public.invoice_returns where created_at >= now() - interval '1 day') out_ok
from r_rep;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
\echo R13 expect not authorized (a seller without returns):
select public.return_items((select id from r_cash), jsonb_build_array(jsonb_build_object('id', (select id from r_line where sku = 'STK-50'), 'qty', 1)));
reset role;

-- an order from the app, prepared with what is on the shelf (the parts' ids read here: a customer cannot read the table)
create temp table r_pid as select sku, id from public.products where sku in ('ORD-H', 'BK-1');
grant select on r_pid to authenticated;
set role authenticated; select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
create temp table r_ord as select (r->>'id')::uuid id, (r->>'no') no from public.place_order(jsonb_build_object('name', 'سالم', 'phone', '0912223344', 'items', jsonb_build_array(
  jsonb_build_object('id', (select id from r_pid where sku = 'ORD-H'), 'qty', 2),
  jsonb_build_object('id', (select id from r_pid where sku = 'BK-1'), 'qty', 1)))) r;
grant select on r_ord to authenticated;
create temp table r_none as select (r->>'id')::uuid id from public.place_order(jsonb_build_object('name', 'سالم', 'phone', '0912223344', 'items', jsonb_build_array(
  jsonb_build_object('id', (select id from r_pid where sku = 'BK-1'), 'qty', 1)))) r;
grant select on r_none to authenticated;
reset role;
create temp table r_oline as select it.id, p.sku from public.invoice_items it join public.products p on p.id = it.product_id where it.invoice_id = (select id from r_ord);
create temp table r_nline as select it.id from public.invoice_items it where it.invoice_id = (select id from r_none);
grant select on r_oline, r_nline to authenticated;
set role authenticated; select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select 'R14 the warehouse sees the order and may change its quantities (expect t, 2)' t, (r->>'can_short')::boolean can, jsonb_array_length(r->'lines') lines
from public.pick_list() r where r->>'id' = (select id::text from r_ord);
\echo R15 expect bad quantity (more than ordered):
select public.pick_done((select id from r_ord), jsonb_build_array(jsonb_build_object('id', (select id from r_oline where sku = 'ORD-H'), 'qty', 3)));
select 'R16 one of two and none of the other: sent with what was found (expect 2, ready)' t, r->>'short' short, r->>'order' st
from public.pick_done((select id from r_ord), jsonb_build_array(jsonb_build_object('id', (select id from r_oline where sku = 'ORD-H'), 'qty', 1),
                                                                jsonb_build_object('id', (select id from r_oline where sku = 'BK-1'), 'qty', 0))) r;
select 'R17 nothing found: the order is cancelled (expect 1, cancelled)' t, r->>'short' short, r->>'order' st
from public.pick_done((select id from r_none), jsonb_build_array(jsonb_build_object('id', (select id from r_nline), 'qty', 0))) r;
reset role;
select 'R18 the order kept what was found, the rest back in stock (expect ready, 99.00, t, t)' t, status, total,
  (select qty from public.products where sku = 'ORD-H') = (select qty from r_stock where sku = 'ORD-H') - 1 ord_h,
  (select qty from public.products where sku = 'BK-1') = (select qty from r_stock where sku = 'BK-1') bk_1
from public.invoices where id = (select id from r_ord);
set role authenticated; select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
select 'R19 the customer sees what was not found (expect ready, 1-1, 0-1, cancelled, القطع مش موجودة في المخزن)' t, r->>'status' status,
  (select string_agg((x->>'qty') || '-' || (x->>'short'), ', ') from jsonb_array_elements(r->'items') x where x->>'product_id' = (select id::text from r_pid where sku = 'ORD-H')) ord_h,
  (select string_agg((x->>'qty') || '-' || (x->>'short'), ', ') from jsonb_array_elements(r->'items') x where x->>'product_id' = (select id::text from r_pid where sku = 'BK-1')) bk_1,
  (select x->>'status' from public.my_order((select id from r_none)) x) none_st, (select x->>'cancel_reason' from public.my_order((select id from r_none)) x) reason
from public.my_order((select id from r_ord)) r;
reset role;
select 'R20 the log names what was short (expect 2, ready)' t, detail->>'short' short, detail->>'order' st from public.activity_log where kind = 'picked' and ref = (select id::text from r_ord);
