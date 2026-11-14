\pset footer off
-- Company edition checks. Run after behaviour.sql and country_tests.sql (uses their shops/products and users).
-- users: 11111111 = first account (admin), 44444444 = EG shop owner (from country_tests)
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'customer@test.local'), ('66666666-6666-6666-6666-666666666666', 'rival@test.local');

\echo M1 anon cannot read the products table directly (expect 0)
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'M1' t, count(*) from public.products;
select 'M2 anon search shows prices in mode all' t, count(*) filter (where (r->>'price') is not null) priced, count(*) total from public.search_products() r;
reset role;

-- admin switches to hidden prices
update public.settings set price_mode = 'hidden' where id = 1;
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'M3 hidden: anon sees no price' t, count(*) filter (where (r->>'price') is not null) priced, count(*) filter (where (r->>'price_hidden')::boolean) hidden_flag from public.search_products() r;
select 'M4 sort cheap does not leak (same order as new)' t, (select array_agg(r->>'id') from public.search_products(p_sort => 'cheap') r) = (select array_agg(r->>'id') from public.search_products(p_sort => 'new') r) as same_order;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select 'M5 owner still sees own prices' t, count(*) filter (where (r->>'price') is not null) own_priced from public.search_products(p_country => 'EG') r;
reset role;

-- members mode
update public.settings set price_mode = 'members' where id = 1;
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'M6 members: anon hidden' t, count(*) filter (where (r->>'price') is not null) priced from public.search_products() r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'M7 members: signed-in sees prices' t, count(*) filter (where (r->>'price') is not null) priced from public.search_products() r;
-- customer profile, cannot self-approve
insert into public.customers (name, phone, approved) values ('زبون تجربة', '0911111111', true);
select 'M8 self-approve blocked' t, approved from public.customers;
update public.customers set approved = true;
select 'M9 still not approved' t, approved from public.customers;
reset role;

-- approved mode
update public.settings set price_mode = 'approved' where id = 1;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'M10 approved mode, not yet approved' t, count(*) filter (where (r->>'price') is not null) priced from public.search_products() r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'M11 admin sees customers' t, count(*) from public.customers;
update public.customers set approved = true where user_id = '55555555-5555-5555-5555-555555555555';
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select 'M12 approved customer sees prices' t, count(*) filter (where (r->>'price') is not null) priced from public.search_products() r;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'M13 other signed-in user (not approved) hidden' t, count(*) filter (where (r->>'price') is not null) priced from public.search_products() r;
select 'M14 rival cannot read customers' t, count(*) from public.customers;
reset role;

-- per-product hide in mode all
update public.settings set price_mode = 'all' where id = 1;
update public.products set hide_price = true where id = (select id from public.products where price is not null order by created_at limit 1);
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'M15 one product hidden in mode all' t, count(*) filter (where (r->>'price_hidden')::boolean) hidden from public.search_products() r;
reset role;

-- shop sign-up closed
update public.settings set open_signup = false where id = 1;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo M16 expect RLS error (sign-up closed):
insert into public.shops (name, city) values ('Rival', 'طرابلس');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.shops (name, city) values ('Corssky فرع مصراتة', 'مصراتة');
select 'M17 admin can still add a branch' t, count(*) from public.shops where name = 'Corssky فرع مصراتة';
reset role;

-- sync with the sales system
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
\echo M18 expect not authorized (non-admin key rotation):
select public.rotate_sync_key();
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.rotate_sync_key() as k \gset
reset role;
set role anon; select set_config('request.jwt.claim.sub', '', false);
\echo M19 expect invalid sync key:
select public.sync_products('wrong', '[]'::jsonb);
select 'M20 sync insert' t, public.sync_products(:'k', '[{"sku":"HY-58101","title":"فحمات أكسنت أمامية","price":"145,5","qty":12,"make":"Hyundai","model":"Accent","cat":"brakes"},{"sku":"TY-0446","title":"Brake pads Corolla","price":"abc","qty":0,"make":"toyota","cat":"nonsense"},{"title":"no sku"},{"sku":"X1","title":"x"}]'::jsonb) r;
select 'M21 sync update' t, public.sync_products(:'k', '[{"sku":"HY-58101","price":150,"qty":0}]'::jsonb) r;
reset role;
select 'M22 rows after sync' t, sku, title, price, qty, status, make, cat, cond, (search_text <> '') has_text from public.products where sku in ('HY-58101', 'TY-0446') order by sku;
\echo M23 expect duplicate key (sku unique):
insert into public.products (shop_id, title, cat, cond, sku) select shop_id, 'dup', 'other', 'used', 'HY-58101' from public.products where sku = 'HY-58101';
select 'M24 no table privilege on secrets (expect f)' t, has_table_privilege('anon', 'public.app_secrets', 'select') anon_priv;
set role anon; select 'M25 anon reads app_secrets (expect 0 rows)' t, count(*) from public.app_secrets; reset role;
