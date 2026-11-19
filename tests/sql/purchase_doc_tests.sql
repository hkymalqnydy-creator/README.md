\pset footer off
-- One purchase invoice for its page (get_purchase, supabase/setup.sql next to the supplier functions) and the supplier's own
-- invoice number (purchases.supplier_no). Run last. 11111111 = owner, 77777777 = a seller given purchases only, 66666666 = an outsider.
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'PD0 the seller gets purchases only' t, (r->>'active') active from public.save_staff('seller@test.local', 'بائع', array['purchases'], null, true) r;
-- part paid: 10 × 28 by code, 1 × 5 picked from the catalog, and a new part 2 × 15 = 315, 100 paid now
create temp table d_pur as select (r->>'id')::uuid id, (r->>'no')::int no from public.receive_stock(jsonb_build_object('supplier', 'مؤسسة الدفتر', 'supplier_no', '  INV-77/A ', 'paid', 100,
  'items', jsonb_build_array(jsonb_build_object('sku', 'POS-1', 'qty', 10, 'cost', 28),
                             jsonb_build_object('product_id', (select id from public.products where sku = 'STK-50'), 'qty', 1, 'cost', 5),
                             jsonb_build_object('title', 'قطعة الدفتر الجديدة', 'sku', 'PD-NEW-1', 'qty', 2, 'cost', 15)))) r;
grant select on d_pur to authenticated;
reset role;
select 'PD1 the supplier invoice number is kept, trimmed (expect INV-77/A)' t, supplier_no from public.purchases where id = (select id from d_pur);
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'PD2 the owner sees the whole invoice (expect مؤسسة الدفتر, INV-77/A, 315.00, 100.00, part, t, 3)' t, r->>'supplier' sup, r->>'supplier_no' sno, r->>'total' total, r->>'paid' paid,
  r->>'pay' pay, (r->>'can_undo')::boolean undo, jsonb_array_length(r->'items') lines
from public.get_purchase((select id from d_pur)) r;
select 'PD3 its lines, each with its code (the catalog part by its own), the new one marked (expect POS-1|10|28.00|false, STK-50|1|5.00|false, PD-NEW-1|2|15.00|true)' t,
  string_agg(concat_ws('|', x->>'code', x->>'qty', x->>'cost', x->>'created'), ', ' order by (x->>'id')::bigint) lines
from public.get_purchase((select id from d_pur)) r, jsonb_array_elements(r->'items') x;
select 'PD4 the branch, and what the supplier is owed now (expect t, 215.00)' t, r->'branch'->>'name' is not null branch, r->>'sup_balance' owed from public.get_purchase((select id from d_pur)) r;
select 'PD5 found by the supplier invoice number, spaces and dashes aside (expect t, t)' t,
  exists (select 1 from public.list_purchases(30, 0, 'inv77/a') r where r->>'id' = (select id::text from d_pur)) bare,
  exists (select 1 from public.list_purchases(30, 0, 'INV-77/A') r where r->>'id' = (select id::text from d_pur)) exact;
select 'PD6 paid 60 later (expect 155.00)' t, (public.add_supplier_payment(public.sup_key('مؤسسة الدفتر'), 60, 'دفعة'))->>'balance' bal;
select 'PD7 the page says so too (expect 155.00)' t, r->>'sup_balance' owed from public.get_purchase((select id from d_pur)) r;
-- (each receipt in its own statement: a stable function does not see rows written earlier in the same statement)
create temp table d_full as select (r->>'id')::uuid id from public.receive_stock(jsonb_build_object('supplier', 'مؤسسة الدفتر', 'items', jsonb_build_array(jsonb_build_object('sku', 'POS-1', 'qty', 1, 'cost', 28)))) r;
create temp table d_cred as select (r->>'id')::uuid id from public.receive_stock(jsonb_build_object('supplier', 'مؤسسة الدفتر', 'paid', 0, 'items', jsonb_build_array(jsonb_build_object('sku', 'POS-1', 'qty', 1, 'cost', 28)))) r;
select 'PD8 paid in full on receiving, and on credit (expect full, credit)' t,
  (public.get_purchase((select id from d_full)))->>'pay' full_pay, (public.get_purchase((select id from d_cred)))->>'pay' credit;
select 'PD9 a purchase that is not there (expect t)' t, public.get_purchase(gen_random_uuid()) is null gone;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'PD10 a seller without the costs permission: the parts and quantities, no money (expect t, 0, 3, f)' t,
  r->>'total' is null and r->>'paid' is null and r->>'pay' is null and r->>'sup_balance' is null no_money,
  (select count(*) from jsonb_array_elements(r->'items') x where x->>'cost' is not null) costs, jsonb_array_length(r->'items') lines, (r->>'can_undo')::boolean undo
from public.get_purchase((select id from d_pur)) r;
create temp table d_own as select (r->>'id')::uuid id from public.receive_stock(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('sku', 'POS-1', 'qty', 1)))) r;
select 'PD11 his own receipt today he may take back (expect true)' t, (public.get_purchase((select id from d_own)))->>'can_undo' undo;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'PD12 an outsider sees nothing (expect t)' t, public.get_purchase((select id from d_pur)) is null nothing;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'PD13 taken back (expect 3)' t, (public.undo_receipt((select id from d_pur)))->>'parts' parts;
select 'PD14 its page is gone (expect t)' t, public.get_purchase((select id from d_pur)) is null gone;
reset role;
