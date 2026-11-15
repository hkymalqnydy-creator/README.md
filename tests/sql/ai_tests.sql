\pset footer off
-- The AI assistant (supabase/setup.sql section 14). Run after ads_tests.sql.
-- 11111111 = owner/admin, 66666666 = signed-in user who is not staff (a customer), 77777777 = seller@test.local

-- the manager always has it, with everything
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'I1 the manager has the assistant with every permission (expect t, 12, admin)' t, (p->>'ai')::boolean ai, jsonb_array_length(p->'ai_perms') n, public.ai_access()->>'role' role
from public.my_perms() p;
select 'I2 a seller saved without it (expect false, [])' t, r->'ai_on' ai_on, r->'ai_perms' ai_perms
from public.save_staff('seller@test.local', 'بائع', array['sales', 'invoices', 'products'], null, true) r;
reset role;

-- a seller has no assistant until the manager gives it, and cannot give it to himself
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'I3 the seller: no assistant (expect f, [], f, staff)' t, (p->>'ai')::boolean ai, p->'ai_perms' ai_perms, (a->>'ok')::boolean ok, a->>'role' role
from public.my_perms() p, public.ai_access() a;
\echo I4 expect ai not allowed:
select public.ai_gate('00000000-0000-0000-0000-0000000000a1');
\echo I5 expect not authorized (only the manager gives it):
select public.save_staff('seller@test.local', 'بائع', array['sales'], null, true, null, true, array['sales']);
reset role;

-- the manager gives it for sales only; what the seller himself may not do is dropped, and it follows his permissions
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'I6 given for sales; "costs" (not his) dropped (expect true, ["sales"])' t, r->'ai_on' ai_on, r->'ai_perms' ai_perms
from public.save_staff('seller@test.local', 'بائع', array['sales', 'invoices', 'products'], null, true, null, true, array['sales', 'costs']) r;
select 'I7 saving him without the assistant fields keeps it (expect true, ["sales"])' t, r->'ai_on' ai_on, r->'ai_perms' ai_perms
from public.save_staff('seller@test.local', 'بائع', array['sales', 'invoices', 'products'], null, true) r;
select 'I8 taking "sales" from him takes it from the assistant too (expect true, [])' t, r->'ai_on' ai_on, r->'ai_perms' ai_perms
from public.save_staff('seller@test.local', 'بائع', array['invoices', 'products'], null, true) r;
select 'I9 sales and products for the assistant (expect products,sales)' t, (select string_agg(x, ',' order by x) from jsonb_array_elements_text(r->'ai_perms') x) ai_perms
from public.save_staff('seller@test.local', 'بائع', array['sales', 'invoices', 'products'], null, true, null, true, array['sales', 'products']) r;
select 'I10 the log shows what the assistant may do now and before (expect true, products,sales, [])' t, detail->'ai_on' ai_on,
       (select string_agg(x, ',' order by x) from jsonb_array_elements_text(detail->'ai_perms') x) now, detail->'was'->'ai_perms' was
from public.activity_log where kind = 'staff' order by id desc limit 1;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'I11 the seller now (expect t, products,sales, t)' t, (p->>'ai')::boolean ai, (select string_agg(x, ',' order by x) from jsonb_array_elements_text(p->'ai_perms') x) ai_perms,
       (public.ai_access()->>'ok')::boolean ok
from public.my_perms() p;
reset role;

-- the day's limit counts messages, not the calls one message takes
update public.settings set ai_daily = 5 where id = 1;
delete from public.ai_turns;
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select 'I12 first message (expect staff, 4, بائع)' t, g->>'role' role, g->>'left' "left", g->>'me' me from public.ai_gate('00000000-0000-0000-0000-0000000000a1') g;
select 'I13 a second call for the same message is not counted (expect 4)' t, g->>'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000a1') g;
select 'I14a' t, g->>'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000a2') g;
select 'I14b' t, g->>'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000a3') g;
select 'I14c' t, g->>'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000a4') g;
select 'I14 the fifth message (expect 0)' t, g->>'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000a5') g;
\echo I15 expect ai daily limit (a sixth message):
select public.ai_gate('00000000-0000-0000-0000-0000000000a6');
select 'I16 the fifth message can still take its next steps (expect 0)' t, g->>'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000a5') g;
\echo I17 expect ai too many steps (more than 12 calls for one message):
do $$ begin for i in 1..11 loop perform public.ai_gate('00000000-0000-0000-0000-0000000000a5'); end loop; end $$;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'I18 the manager has no daily limit (expect admin, null)' t, g->>'role' role, g->'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000b1') g;
reset role;

-- customers: only when the manager allows, and only finding parts and questions
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'I19 a customer, not allowed yet (expect f, customer)' t, (a->>'ok')::boolean ok, a->>'role' role from public.ai_access() a;
reset role;
update public.settings set ai_customers = true where id = 1;
set role authenticated; select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select 'I20 customers allowed: nothing to change for them (expect t, customer, [])' t, (a->>'ok')::boolean ok, a->>'role' role, a->'perms' perms from public.ai_access() a;
select 'I21 a customer message counts too (expect customer, 4)' t, g->>'role' role, g->>'left' "left" from public.ai_gate('00000000-0000-0000-0000-0000000000c1') g;
\echo I22 expect not authorized (a customer does not write in the log):
select public.ai_log('x');
reset role;

-- what the assistant did, in the log, and the manager's view of the use
set role authenticated; select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
select public.ai_log('فاتورة بيع رقم 7', 'sell', 'بيع 2 فلتر لسالم', 'inv-7');
\echo I23 expect not authorized (only the manager sees the use):
select public.ai_usage(1);
reset role;
select 'I24 the log line (expect ai, بائع, فاتورة بيع رقم 7, sell, بيع 2 فلتر لسالم)' t, kind, actor_name, title, detail->>'tool' tool, detail->>'ask' ask
from public.activity_log order by id desc limit 1;
set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select 'I25 the log filter for the assistant (expect 1)' t, (public.list_activity('ai')->>'total')::int n;
select 'I26 use today (expect بائع 5 7: the failed loop above was undone; then the manager and the customer with 1 each)' t, x->>'name' name, x->>'messages' messages, x->>'calls' calls
from jsonb_array_elements(public.ai_usage(1)) x;
\echo I27 expect violates check constraint (a limit under 5):
update public.settings set ai_daily = 2 where id = 1;
update public.settings set ai_rules = 'التوصيل لطرابلس ببلاش فوق 500 دينار' where id = 1;
select 'I28 the log names the instructions without copying them (expect true, true)' t, detail->'keys' ? 'ai_rules' named, not (coalesce(detail->'changes', '{}'::jsonb) ? 'ai_rules') not_copied
from public.activity_log where kind = 'settings' order by id desc limit 1;
reset role;
update public.settings set ai_customers = false, ai_daily = 40, ai_rules = '' where id = 1;
