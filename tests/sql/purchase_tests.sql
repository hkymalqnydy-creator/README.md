\pset footer off
-- Stock receiving (from an invoice photo or barcodes). Run after pos_tests.sql (seller 77777777 exists, inactive).
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'R0 seller gets purchases only' t, (r->>'active') active from public.save_staff('seller@test.local', 'بائع', array['purchases'], null, true) r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'R1 receive: existing by item code + 2 new (expect new 2, updated 1, total 405)' t, r->>'new' new, r->>'updated' upd, r->>'total' total
from public.receive_stock(jsonb_build_object('supplier', 'مورد كوري', 'items', jsonb_build_array(
  jsonb_build_object('sku', 'POS-1', 'qty', 10, 'cost', '28,5'),
  jsonb_build_object('title', 'فلتر هواء توسان', 'sku', 'NEW-AIR-1', 'qty', 4, 'cost', 30, 'price', 45),
  jsonb_build_object('barcode', '8801234567890', 'title', 'زيت بباركود', 'qty', 1)))) r;
reset role;
select 'R2 POS-1 stock 5+10=15, cost 28.50' t, qty, cost from public.products where sku = 'POS-1';
select 'R3 new item; selling price ignored without products permission' t, title, qty, cost, price from public.products where sku = 'NEW-AIR-1';
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'R4 same barcode again updates (expect new 0, updated 1)' t, r->>'new' new, r->>'updated' upd
from public.receive_stock(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('barcode', '8801234567890', 'qty', 2)))) r;
\echo R5 expect new item needs a name (whole receipt rolled back):
select public.receive_stock(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('sku', 'POS-1', 'qty', 1), jsonb_build_object('qty', 1))));
select 'R6 receipts listed (expect 2), POS-1 still 15' t, (select count(*) from public.list_purchases()) receipts, (select qty from public.products where sku = 'POS-1') pos1;
\echo R7 expect not authorized (no sales permission):
select public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'POS-1'), 'qty', 1))));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo R8 expect not authorized (outsider):
select public.receive_stock(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('sku', 'POS-1', 'qty', 1))));
select 'R9 outsider sees no receipts' t, count(*) from public.list_purchases();
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'R10 owner sets selling price while receiving' t, r->>'updated' upd from public.receive_stock(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('sku', 'NEW-AIR-1', 'qty', 1, 'price', 45)))) r;
reset role;
select 'R11 price now 45, qty 5' t, price, qty from public.products where sku = 'NEW-AIR-1';
