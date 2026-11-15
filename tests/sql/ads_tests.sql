\pset footer off
-- Ads at the top of the home screen (settings.ads, supabase/setup.sql section 13). Run after controls_tests.sql.
-- 11111111 = owner/admin, 77777777 = staff without the settings right (seller@test.local)

-- the owner saves two ads; everyone reads them with the settings
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.settings set ads = '[
  {"id": "patrol", "img": "https://images.pexels.com/photos/12138615/pexels-photo-12138615.png?auto=compress&fm=jpg&w=1400", "title": "قطع غيار نيسان باترول",
   "sub": "فلاتر وفحمات ومساعدات ورادياتيرات، أصلي وتجاري.", "cta": "تسوّق قطع الباترول", "go": "q", "to": "باترول", "pos": "", "until": "", "on": true},
  {"id": "kia", "img": "", "title": "تخفيضات فحمات كيا", "sub": "", "cta": "", "go": "url", "to": "https://example.com/kia", "pos": "bottom", "until": "2030-12-31", "on": false}
]'::jsonb where id = 1;
select 'A1 two ads saved (expect 2, patrol,kia)' t, jsonb_array_length(ads) n, (select string_agg(x->>'id', ',') from jsonb_array_elements(ads) x) ids from public.settings where id = 1;
select 'A2 the log names the change without copying the ads (expect ads, false)' t, title, detail->'changes' ? 'ads' copied
from public.activity_log where kind = 'settings' order by id desc limit 1;
reset role;
set role anon; select set_config('request.jwt.claim.sub', '', false);
select 'A3 a visitor reads them (expect 2, قطع غيار نيسان باترول)' t, jsonb_array_length(ads) n, ads->0->>'title' first from public.settings where id = 1;
reset role;

-- what the database refuses
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
\echo A4 expect violates check constraint (a link that is not https):
update public.settings set ads = '[{"id": "x", "title": "t", "go": "url", "to": "javascript:alert(1)"}]'::jsonb where id = 1;
\echo A5 expect violates check constraint (a picture that is not an https address):
update public.settings set ads = '[{"id": "x", "title": "t", "img": "javascript:alert(1)"}]'::jsonb where id = 1;
\echo A6 expect violates check constraint (six ads):
update public.settings set ads = (select jsonb_agg(jsonb_build_object('id', 'a' || i, 'title', 't')) from generate_series(1, 6) i) where id = 1;
\echo A7 expect violates check constraint (not a list):
update public.settings set ads = '{"id": "x"}'::jsonb where id = 1;
\echo A8 expect violates check constraint (an unknown kind of tap):
update public.settings set ads = '[{"id": "x", "title": "t", "go": "call", "to": "0912345678"}]'::jsonb where id = 1;
\echo A9 expect violates check constraint (an unknown place for the words):
update public.settings set ads = '[{"id": "x", "title": "t", "pos": "middle"}]'::jsonb where id = 1;
\echo A10 expect violates check constraint (a last day that is not a date):
update public.settings set ads = '[{"id": "x", "title": "t", "until": "next week"}]'::jsonb where id = 1;
\echo A11 expect violates check constraint (a title longer than 60):
update public.settings set ads = jsonb_build_array(jsonb_build_object('id', 'x', 'title', repeat('ب', 61))) where id = 1;
\echo A12 expect violates check constraint (shown must be true or false):
update public.settings set ads = '[{"id": "x", "title": "t", "on": "yes"}]'::jsonb where id = 1;
\echo A13 expect violates check constraint (an ad that is not an object):
update public.settings set ads = '["just words"]'::jsonb where id = 1;
select 'A14 still the two ads after the refusals (expect 2)' t, jsonb_array_length(ads) n from public.settings where id = 1;
reset role;

-- staff without the settings right cannot change them
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
update public.settings set ads = '[]'::jsonb where id = 1;
reset role;
select 'A15 a seller cannot clear the ads (expect 2)' t, jsonb_array_length(ads) n from public.settings where id = 1;

-- no ads at all is fine
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.settings set ads = '[]'::jsonb where id = 1;
select 'A16 the owner clears them (expect 0)' t, jsonb_array_length(ads) n from public.settings where id = 1;
reset role;
