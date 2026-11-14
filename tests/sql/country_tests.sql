\pset footer off
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'eg@test.local');
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
insert into public.shops (name, city, country, currency, whatsapp) values ('Cairo Parts', 'القاهرة', 'EG', 'EGP', '201000000000');
insert into public.products (shop_id, title, cat, cond, price, make, model, search_text)
  select id, 'Brake pads Elantra', 'brakes', 'aftermarket', 900, 'hyundai', 'Elantra / Avante', 'brake pads elantra' from public.shops where name = 'Cairo Parts';
reset role;
select 'C1 search LY excludes EG' t, count(*) filter (where (r->'shop'->>'country') = 'EG') as eg_rows_should_be_0, count(*) as ly_rows
  from public.search_products(p_country => 'LY') r;
select 'C2 search EG' t, string_agg(r->>'title', ',') titles, max(r->'shop'->>'currency') cur from public.search_products(p_country => 'EG') r;
select 'C3 list_cities EG' t, string_agg(r::text, ',') from public.list_cities('EG') r;
select 'C4 country_stats' t, string_agg(r::text, ' ') from public.country_stats() r;
select 'C5 list_shops EG' t, string_agg(r->>'name' || ':' || (r->>'country') || ':' || (r->>'currency'), ',') from public.list_shops(p_country => 'EG') r;
select 'C6 stats EG' t, public.store_stats(null, null, 'EG');
select 'C7 norm_ar latin' t, public.norm_ar('Citroën ŠKODA Peugeot Ölçü ١٢٣');
select 'C8 default country' t, country, currency from public.shops where name <> 'Cairo Parts' limit 1;
\echo C9 expect check error (lowercase country):
update public.shops set country = 'eg' where name = 'Cairo Parts';
\echo C10 expect check error (bad currency):
update public.shops set currency = 'EURO' where name = 'Cairo Parts';
