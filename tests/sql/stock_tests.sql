\pset footer off
-- The Stock page's «قرب يخلص» and «خلصت» (supabase/setup.sql: stock_report). Run after orders_tests.sql.
-- 11111111 = owner/admin
insert into public.products (shop_id, owner_id, title, cat, cond, price, qty, cost, sku)
select s.id, s.owner_id, x.t, 'other', 'original', 20, x.q, 10, x.k
from (select * from public.shops where owner_id = '11111111-1111-1111-1111-111111111111' order by created_at limit 1) s,
     (values ('أ صنف ثلاثة', 3, 'STK-3'), ('ب صنف اثنين', 2, 'STK-2'), ('ج صنف واحد', 1, 'STK-1'), ('د صنف خلص', 0, 'STK-0'), ('هـ صنف كثير', 50, 'STK-50')) x(t, q, k);
update public.products set status = 'sold' where sku = 'STK-0';
update public.settings set low_stock = 3 where id = 1;

set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'S1 running low, the fewest left first (expect t)' t,
  (select array_agg((x->>'qty')::integer order by n) from jsonb_array_elements(r->'low_items') with ordinality a(x, n))
    = (select array_agg((x->>'qty')::integer order by (x->>'qty')::integer, n) from jsonb_array_elements(r->'low_items') with ordinality a(x, n)) ordered
from public.stock_report() r;
select 'S2 ours among them, with what is left (expect 1, 2, 3)' t,
  (select x->>'qty' from jsonb_array_elements(r->'low_items') x where x->>'sku' = 'STK-1') one,
  (select x->>'qty' from jsonb_array_elements(r->'low_items') x where x->>'sku' = 'STK-2') two,
  (select x->>'qty' from jsonb_array_elements(r->'low_items') x where x->>'sku' = 'STK-3') three
from public.stock_report() r;
select 'S3 the one that ran out is named (expect t, f)' t, exists (select 1 from jsonb_array_elements(r->'out_items') x where x->>'sku' = 'STK-0') out_named,
  exists (select 1 from jsonb_array_elements(r->'low_items') x where x->>'sku' in ('STK-0', 'STK-50')) wrong
from public.stock_report() r;
select 'S4 the counts match (expect t, t)' t, (r->'summary'->>'low')::integer >= 3 low_counted, (r->'summary'->>'out')::integer >= 1 out_counted from public.stock_report() r;
select 'S5 the «running low» list, the fewest first (expect STK-1,STK-2,STK-3)' t, (select string_agg(x->>'sku', ',' order by n) from jsonb_array_elements(r->'items') with ordinality a(x, n)) skus
from public.stock_report('STK-', 'low') r;
select 'S6 the whole list stays by name (expect STK-3,STK-2,STK-1,STK-0,STK-50)' t, (select string_agg(x->>'sku', ',' order by n) from jsonb_array_elements(r->'items') with ordinality a(x, n)) skus
from public.stock_report('STK-') r;
select 'S7 not repeated on the next pages (expect null, null)' t, r->'low_items' low, r->'out_items' outs from public.stock_report(null, 'all', 50, 50) r;
reset role;

-- the company that made the part (products.maker): imported, searched, on the Stock page, kept on the sold line
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'S8 imported with its company and model (expect 1 inserted)' t, (r->>'inserted')::integer n
from public.import_products('[{"sku":"MK-1","title":"فحمات أمامية","maker":"موبيس","make":"hyundai","model":"Tucson","qty":"7","price":"95"}]'::jsonb) r;
reset role;
select 'S9 saved, and in the search words (expect موبيس, Tucson, t)' t, maker, model, search_text like '%موبيس%' indexed from public.products where sku = 'MK-1';
select 'S10 the catalog finds it by the company (expect فحمات أمامية, موبيس)' t, r->>'title' title, r->>'maker' maker
from public.search_products(p_patterns => array['موبيس']) r where r->>'sku' = 'MK-1';
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'S11 the Stock page finds it by the company and by the model (expect 1, 1, موبيس, Tucson)' t, (a->>'total')::integer by_maker, (b->>'total')::integer by_model,
       a->'items'->0->>'maker' maker, a->'items'->0->>'model' model
from public.stock_report('موبيس') a, public.stock_report('tucson') b;
create temp table mk_sale as select (r->>'id')::uuid id from public.create_invoice(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', (select id from public.products where sku = 'MK-1'), 'qty', 1)))) r;
select 'S12 the sold line keeps the company (expect موبيس)' t, r->'items'->0->>'maker' maker from public.get_invoice((select id from mk_sale)) r;
select 'S13 a sync changes the company and the search words follow (expect 1 updated)' t, (r->>'updated')::integer n
from public.import_products('[{"sku":"MK-1","maker":"ماندو"}]'::jsonb) r;
reset role;
select 'S14 (expect ماندو, t, f)' t, maker, search_text like '%ماندو%' new_word, search_text like '%موبيس%' old_word from public.products where sku = 'MK-1';
select 'S15 the old sale still says موبيس' t, maker from public.invoice_items where invoice_id = (select id from mk_sale);

-- receiving like the sales: the manufacturer on the receipt line, and the receipts found by supplier, part name, item code, manufacturer or car
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
create temp table mk_rcv as select (r->>'id')::uuid id, (r->>'no') no from public.receive_stock(jsonb_build_object('supplier', 'شركة الأمانة للقطع', 'items', jsonb_build_array(
  jsonb_build_object('sku', 'MK-1', 'qty', 4, 'cost', 60, 'maker', 'دنسو'),
  jsonb_build_object('part_no', 'SR-77-01', 'title', 'مساعد خلفي', 'qty', 2, 'cost', 150, 'maker', 'كيه واي بي', 'make', 'kia', 'model', 'Sportage')))) r;
reset role;
select 'S16 a part that has a company keeps it; a new part gets the one given (expect MK-1 ماندو, SR-77-01 كيه واي بي t)' t, coalesce(sku, part_no) code, maker, search_text like '%' || public.norm_ar('كيه واي بي') || '%' indexed
from public.products where sku = 'MK-1' or part_no = 'SR-77-01' order by code;
select 'S17 the receipt lines keep the company (expect ماندو, كيه واي بي)' t, string_agg(maker, ', ' order by id) makers from public.purchase_items where purchase_id = (select id from mk_rcv);
update public.products set maker = '' where sku = 'MK-1';
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'S18 a part with no company gets the one on the line (expect 1 updated)' t, (r->>'updated')::integer n
from public.receive_stock('{"items":[{"sku":"MK-1","qty":1,"maker":"موبيس"}]}'::jsonb) r;
reset role;
select 'S19 (expect موبيس, t)' t, maker, search_text like '%' || public.norm_ar('موبيس') || '%' indexed from public.products where sku = 'MK-1';
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'S20 receipts found by the supplier, the part name, the item code without dashes, the company and the car (expect t t t t t t)' t,
  exists (select 1 from public.list_purchases(30, 0, 'الامانه') r where r->>'id' = (select id::text from mk_rcv)) supplier,
  exists (select 1 from public.list_purchases(30, 0, 'مساعد') r where r->>'id' = (select id::text from mk_rcv)) part_name,
  exists (select 1 from public.list_purchases(30, 0, 'sr7701') r where r->>'id' = (select id::text from mk_rcv)) item_code,
  exists (select 1 from public.list_purchases(30, 0, 'كيه واي بي') r where r->>'id' = (select id::text from mk_rcv)) company,
  exists (select 1 from public.list_purchases(30, 0, 'sportage') r where r->>'id' = (select id::text from mk_rcv)) car,
  exists (select 1 from public.list_purchases(30, 0, (select no from mk_rcv)) r where r->>'id' = (select id::text from mk_rcv)) number;
select 'S21 nothing found, and every receipt without a search (expect 0, t)' t, (select count(*) from public.list_purchases(30, 0, 'لا يوجد شيء كهذا')) none,
  (select count(*) from public.list_purchases(100, 0, '')) = (select count(*) from public.purchases) all_shown;
select 'S22 a line says its company and car (expect كيه واي بي, kia, Sportage)' t, it->>'maker' maker, it->>'make' make, it->>'model' model
from public.list_purchases(30, 0, 'مساعد') r, jsonb_array_elements(r->'items') it where it->>'title' = 'مساعد خلفي';
reset role;
