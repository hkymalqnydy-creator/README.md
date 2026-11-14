\pset footer off
-- Receiving stock. Run after pos_tests.sql. 77777777 = seller (inactive at the end of pos_tests), 11111111 = owner.
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'R1 seller gets purchases perm' t, (r->>'active') active from public.save_staff('seller@test.local', 'بائع', array['purchases'], null, true) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'R2 receive: existing by sku, by part_no, and a new barcode item' t, r
from public.receive_stock(jsonb_build_object('supplier', 'مورد كوري', 'items', jsonb_build_array(
  jsonb_build_object('sku', 'POS-1', 'qty', 10, 'cost', '28,5'),
  jsonb_build_object('part_no', 'pos-1', 'qty', 1),
  jsonb_build_object('barcode', '8801234567890', 'title', 'فلتر هواء جديد', 'qty', 4, 'cost', 20, 'price', 35, 'cat', 'oils')))) r;
\echo R3 expect sales not authorized (seller has only purchases now):
select public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', '00000000-0000-0000-0000-000000000000'))));
\echo R4 expect new item needs a name:
select public.receive_stock(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('barcode', 'NOPE', 'qty', 1))));
select 'R5 purchases list' t, count(*) n, max((r->>'items_count')::int) items from public.list_purchases() r;
reset role;
select 'R6 stock after receiving' t, sku, barcode, title, qty, cost, price, (search_text like '%8801234567890%' or search_text like '%pos-1%') indexed from public.products where sku = 'POS-1' or barcode = '8801234567890' order by title;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo R7 expect not authorized (outsider):
select public.receive_stock(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('sku', 'POS-1', 'qty', 1))));
select 'R8 outsider sees no purchases' t, count(*) from public.list_purchases();
reset role;
-- sync with a barcode column, selling price needs the products permission, purchase totals need the costs permission
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'R9 import with barcode' t, public.import_products('[{"sku":"BC-1","title":"قطعة بباركود","barcode":"4901234567894","qty":"3"},{"sku":"POS-1","barcode":"8800000000017"}]'::jsonb) r;
reset role;
select 'R10 barcodes stored and searchable' t, sku, barcode, search_text like '%4901234567894%' or search_text like '%8800000000017%' indexed from public.products where sku in ('BC-1', 'POS-1') order by sku;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'R11 seller (purchases only) cannot set a selling price' t, r->>'new' new_items from public.receive_stock('{"items":[{"barcode":"111222333","title":"قطعة سعرها محمي","qty":2,"cost":10,"price":999}]}'::jsonb) r;
select 'R12 seller sees no purchase totals' t, count(*) filter (where r->>'total' is null) masked, count(*) n from public.list_purchases() r;
select 'R12b seller sees no item costs' t, count(*) from public.list_purchases() r, jsonb_array_elements(r->'items') it where it->>'cost' is not null;
reset role;
select 'R13 protected price stayed empty' t, title, price, cost, qty from public.products where barcode = '111222333';
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'R14 owner sees purchase totals' t, count(*) filter (where r->>'total' is not null) shown from public.list_purchases() r;
reset role;
