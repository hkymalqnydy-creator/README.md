\set ON_ERROR_STOP on
\pset footer off
-- Two accounts: the first becomes admin.
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'owner@x.ly');
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'b@x.ly');
select 'T1 admins' as t, array_agg(user_id) as admins from public.admins;

-- Admin A creates a shop.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.shops (id, name, city, whatsapp) values ('aaaaaaaa-0000-0000-0000-000000000001', 'الأمانة للقطع الكورية', 'طرابلس', '0911111111');
commit;

-- Merchant B creates a shop, trying to forge owner + verified.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into public.shops (id, name, city, whatsapp, verified, owner_id)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'محل بي', 'بنغازي', '0922222222', true, '11111111-1111-1111-1111-111111111111');
select 'T2 B shop forged fields' as t, owner_id = '22222222-2222-2222-2222-222222222222' as owner_is_b, verified as verified_should_be_false
  from public.shops where id = 'bbbbbbbb-0000-0000-0000-000000000001';
insert into public.products (id, shop_id, title, cat, cond, price, make, model, y_from, y_to, part_no, imgs, search_text)
  values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'فحمات فرامل أمامية', 'brakes', 'original', 145, 'hyundai', 'Accent', 2017, 2011, '58101-1RA00',
          array['22222222-2222-2222-2222-222222222222/abc123def.jpg'], 'فحمات فرامل اماميه 58101-1ra00 هيونداي hyundai accent اكسنت');
insert into public.products (id, shop_id, title, cat, cond, price, make)
  values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'بطارية 70 أمبير', 'electrical', 'original', 520, 'any');
select 'T3 B product owner + year swap + fallback search' as t, owner_id = '22222222-2222-2222-2222-222222222222' as owner_ok, y_from, y_to,
       (select search_text <> '' from public.products where id = 'cccccccc-0000-0000-0000-000000000002') as fallback_search_filled
  from public.products where id = 'cccccccc-0000-0000-0000-000000000001';
-- B edits own shop, tries to self-verify
update public.shops set verified = true, about = 'نبيعوا قطع كورية' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select 'T4 B self-verify blocked' as t, verified, about from public.shops where id = 'bbbbbbbb-0000-0000-0000-000000000001';
-- B tries to edit A's shop
with u as (update public.shops set name = 'مخترق' where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
select 'T5 B edit A shop rows' as t, count(*) as rows_should_be_0 from u;
with d as (delete from public.shops where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
select 'T5b B delete A shop rows' as t, count(*) as rows_should_be_0 from d;
select 'T6 is_admin(B)' as t, public.is_admin() as should_be_false;
with u as (update public.settings set notice = 'hack' where id = 1 returning 1)
select 'T7 B edit settings rows' as t, count(*) as rows_should_be_0 from u;
-- storage: own folder ok
insert into storage.objects (bucket_id, name) values ('photos', '22222222-2222-2222-2222-222222222222/abc123def.jpg');
select 'T8 B upload own folder' as t, true as ok;
commit;

-- B into A's shop: must fail
\set ON_ERROR_STOP off
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo 'T9 expect RLS error (B adds product to A shop):'
insert into public.products (shop_id, title, cat, cond) values ('aaaaaaaa-0000-0000-0000-000000000001', 'قطعة دخيلة', 'other', 'used');
rollback;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo 'T10 expect RLS error (B uploads into A folder):'
insert into storage.objects (bucket_id, name) values ('photos', '11111111-1111-1111-1111-111111111111/zzz999yyy.jpg');
rollback;
begin;
set local role anon;
\echo 'T11 expect error (anon inserts shop):'
insert into public.shops (name, city) values ('مجهول', 'طرابلس');
rollback;
\set ON_ERROR_STOP on

-- anon reads + search
begin;
set local role anon;
select 'T12 anon reads' as t, (select count(*) from public.shops) as shops, (select count(*) from public.products) as products,
       (select admin_wa is not null from public.settings where id = 1) as settings_readable;
select 'T13 search فحمات|تيل' as t, r->>'title' as title, r->'shop'->>'name' as shop, r->>'total_count' as total, r ? 'search_text' as leaks_search_text
  from public.search_products(p_patterns => array['فحمات|فحمه|تيل']) r;
select 'T14 fit Accent 2015 strict' as t, string_agg(r->>'title', ' | ') as titles
  from public.search_products(p_fit_make => 'hyundai', p_fit_model => 'Accent', p_fit_year => 2015, p_fit_strict => true) r;
select 'T15 fit Accent 2015 + general' as t, string_agg(r->>'title', ' | ') as titles
  from public.search_products(p_fit_make => 'hyundai', p_fit_model => 'Accent', p_fit_year => 2015) r;
select 'T16 fit Accent 2020 (out of range)' as t, count(*) filter (where r->>'make' = 'hyundai') as hyundai_rows_should_be_0
  from public.search_products(p_fit_make => 'hyundai', p_fit_model => 'Accent', p_fit_year => 2020, p_fit_strict => true) r;
select 'T17 query year 2015' as t, string_agg(r->>'title', ' | ') as titles from public.search_products(p_years => array[2015]) r;
select 'T18 sort cheap' as t, string_agg(r->>'price', ' < ') as prices from public.search_products(p_sort => 'cheap') r;
select 'T19 by ids' as t, count(*) from public.search_products(p_ids => array['cccccccc-0000-0000-0000-000000000002']::uuid[]) r;
select 'T20 city بنغازي' as t, count(*) as n from public.search_products(p_city => 'بنغازي') r;
select 'T21 stats' as t, public.store_stats() as stats;
select 'T22 list_shops q=الامانه (normalised)' as t, r->>'name' as name, r->>'product_count' as products, r->>'total_count' as total
  from public.list_shops(p_q => 'الامانه') r;
select 'T23 list_shops owner=B' as t, r->>'name' as name, r->>'product_count' as active, r->>'noimg_count' as noimg
  from public.list_shops(p_owner => '22222222-2222-2222-2222-222222222222') r;
commit;

-- Admin powers
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'T24 is_admin(A)' as t, public.is_admin() as should_be_true;
update public.shops set verified = true where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select 'T25 admin verifies B' as t, verified as should_be_true, owner_id = '22222222-2222-2222-2222-222222222222' as owner_kept from public.shops where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.products set status = 'sold' where id = 'cccccccc-0000-0000-0000-000000000002';
select 'T26 admin edits B product' as t, status, owner_id = '22222222-2222-2222-2222-222222222222' as owner_kept from public.products where id = 'cccccccc-0000-0000-0000-000000000002';
update public.settings set admin_wa = '0910000000', notice = 'أهلاً' where id = 1;
select 'T27 admin settings' as t, admin_wa, notice from public.settings;
with d as (delete from storage.objects where name = '22222222-2222-2222-2222-222222222222/abc123def.jpg' returning 1)
select 'T28 admin deletes B photo rows' as t, count(*) as should_be_1 from d;
insert into public.products (shop_id, title, cat, cond, price) values ('bbbbbbbb-0000-0000-0000-000000000001', 'قطعة من الإدارة', 'other', 'used', 10);
select 'T29 admin adds product to B shop -> owner B' as t, owner_id = '22222222-2222-2222-2222-222222222222' as owner_is_shop_owner from public.products where title = 'قطعة من الإدارة';
commit;

-- B deletes own shop: products cascade
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
with d as (delete from public.shops where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1)
select 'T30 B deletes own shop' as t, count(*) as rows_should_be_1 from d;
commit;
select 'T31 cascade' as t, count(*) as products_left_should_be_0 from public.products where shop_id = 'bbbbbbbb-0000-0000-0000-000000000001';
-- third account must not become admin
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'c@x.ly');
select 'T32 admins after 3rd signup' as t, count(*) as should_be_1 from public.admins;
select 'T33 norm_ar' as t, public.norm_ar('الأمانةُ إطار مكيّف') as normalised;
