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
