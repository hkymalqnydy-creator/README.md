-- =====================================================================
--  سبيرات ليبيا: إعداد قاعدة البيانات في Supabase
--  شغّله مرة وحدة من: SQL Editor ← New query ← الصق الملف ← Run
--  آمن لو تعاود تشغيله.
-- =====================================================================

-- ---------- 1) الجداول ----------
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  person      text not null default '' check (char_length(person) <= 60),
  whatsapp    text not null default '' check (char_length(whatsapp) <= 30),
  phone       text not null default '' check (char_length(phone) <= 30),
  city        text not null check (char_length(city) between 2 and 40),
  area        text not null default '' check (char_length(area) <= 80),
  hours       text not null default '' check (char_length(hours) <= 80),
  about       text not null default '' check (char_length(about) <= 600),
  kinds       text[] not null default '{}',
  makes       text[] not null default '{}',
  logo        text,
  cover       text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- كل دولة "سيرفر" مستقل: محلاتها ومدنها وعملتها
alter table public.shops add column if not exists country  text not null default 'LY';
alter table public.shops add column if not exists currency text not null default 'LYD';
do $$ begin
  alter table public.shops add constraint shops_country_chk check (country ~ '^[A-Z]{2}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.shops add constraint shops_currency_chk check (currency ~ '^[A-Z]{3}$');
exception when duplicate_object then null; end $$;

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 120),
  cat         text not null check (char_length(cat) <= 20),
  cond        text not null check (cond in ('original','aftermarket','used','refurb')),
  price       numeric(12,2) check (price is null or (price >= 0 and price <= 99999999)),
  nego        boolean not null default false,
  qty         integer check (qty is null or (qty >= 0 and qty <= 999999)),
  make        text not null default 'any' check (char_length(make) <= 20),
  model       text not null default '' check (char_length(model) <= 60),
  y_from      integer check (y_from is null or y_from between 1950 and 2100),
  y_to        integer check (y_to is null or y_to between 1950 and 2100),
  part_no     text not null default '' check (char_length(part_no) <= 60),
  descr       text not null default '' check (char_length(descr) <= 1200),
  imgs        text[] not null default '{}' check (cardinality(imgs) <= 6),
  search_text text not null default '' check (char_length(search_text) <= 3000),
  status      text not null default 'active' check (status in ('active','sold')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_shop_idx    on public.products (shop_id);
create index if not exists products_created_idx on public.products (created_at desc);
create index if not exists products_cat_idx     on public.products (cat);
create index if not exists products_make_idx    on public.products (make);
create index if not exists products_status_idx  on public.products (status);
create index if not exists products_owner_idx   on public.products (owner_id);
create index if not exists shops_owner_idx      on public.shops (owner_id);
create index if not exists shops_city_idx       on public.shops (city);

create index if not exists shops_country_idx on public.shops (country, city);

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id         integer primary key default 1 check (id = 1),
  admin_wa   text not null default '' check (char_length(admin_wa) <= 30),
  notice     text not null default '' check (char_length(notice) <= 300),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
-- owner controls (section 12): what customers see, selling below cost, the running-low level, the invoice footer
alter table public.settings add column if not exists hide_qty       boolean not null default false;
alter table public.settings add column if not exists hide_branches  boolean not null default false;
alter table public.settings add column if not exists shop_closed    boolean not null default false;
alter table public.settings add column if not exists closed_msg     text    not null default '' check (char_length(closed_msg) <= 300);
alter table public.settings add column if not exists no_below_cost  boolean not null default false;
alter table public.settings add column if not exists low_stock      integer not null default 3 check (low_stock between 0 and 1000);
alter table public.settings add column if not exists invoice_footer text    not null default '' check (char_length(invoice_footer) <= 300);

-- ---------- 2) دوال مساعدة ----------
create or replace function public.norm_ar(t text)
returns text language sql immutable as $$
  -- digits to 0-9 first, then drop Arabic diacritics/tatweel, unify alef/ya/ta-marbuta, fold Latin accents
  select translate(
           regexp_replace(
             translate(lower(coalesce(t, '')), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
             '[\u064B-\u065F\u0670\u0640]', '', 'g'),
           'أإآٱةىؤئáàâäãåāéèêëēíìîïīóòôöõøōúùûüūñçšžčćđýÿğış',
           'ااااهيويaaaaaaaeeeeeiiiiiooooooouuuuuncszccdyygis')
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- 3) أول حساب يتسجّل يولّي مدير التطبيق ----------
create or replace function public.sparat_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admins) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists sparat_first_admin on auth.users;
create trigger sparat_first_admin after insert on auth.users
  for each row execute function public.sparat_first_admin();

insert into public.admins (user_id)
select id from auth.users
where not exists (select 1 from public.admins)
order by created_at limit 1
on conflict do nothing;

-- ---------- 4) حماية الحقول (التوثيق والملكية) ----------
create or replace function public.shops_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.owner_id := auth.uid();
      new.verified := false;
    end if;
    new.created_at := now();
  else
    if not public.is_admin() then
      new.owner_id := old.owner_id;
      new.verified := old.verified;
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists shops_guard on public.shops;
create trigger shops_guard before insert or update on public.shops
  for each row execute function public.shops_guard();

create or replace function public.products_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tmp integer;
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    new.shop_id := old.shop_id;
  end if;
  select s.owner_id into new.owner_id from public.shops s where s.id = new.shop_id;
  if new.owner_id is null then
    raise exception 'shop not found';
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  if new.y_from is not null and new.y_to is not null and new.y_from > new.y_to then
    v_tmp := new.y_from; new.y_from := new.y_to; new.y_to := v_tmp;
  end if;
  if coalesce(new.search_text, '') = '' then
    new.search_text := left(public.norm_ar(concat_ws(' ', new.title, new.part_no, new.sku, new.barcode, new.make, new.model, new.descr)), 3000);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists products_guard on public.products;
create trigger products_guard before insert or update on public.products
  for each row execute function public.products_guard();

-- ---------- 5) صلاحيات الصفوف ----------
alter table public.shops    enable row level security;
alter table public.products enable row level security;
alter table public.admins   enable row level security;
alter table public.settings enable row level security;

drop policy if exists "sparat shops read"    on public.shops;
drop policy if exists "sparat shops insert"  on public.shops;
drop policy if exists "sparat shops update"  on public.shops;
drop policy if exists "sparat shops delete"  on public.shops;
create policy "sparat shops read"   on public.shops for select using (true);
create policy "sparat shops insert" on public.shops for insert to authenticated
  with check (owner_id = auth.uid() or public.is_admin());
create policy "sparat shops update" on public.shops for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "sparat shops delete" on public.shops for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "sparat products read"   on public.products;
drop policy if exists "sparat products insert" on public.products;
drop policy if exists "sparat products update" on public.products;
drop policy if exists "sparat products delete" on public.products;
create policy "sparat products read"   on public.products for select using (true);
create policy "sparat products insert" on public.products for insert to authenticated
  with check (exists (select 1 from public.shops s
                      where s.id = shop_id and (s.owner_id = auth.uid() or public.is_admin())));
create policy "sparat products update" on public.products for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "sparat products delete" on public.products for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "sparat admins self" on public.admins;
create policy "sparat admins self" on public.admins for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "sparat settings read"  on public.settings;
drop policy if exists "sparat settings admin" on public.settings;
create policy "sparat settings read"  on public.settings for select using (true);
create policy "sparat settings admin" on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 6) الصور ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "sparat photos select" on storage.objects;
drop policy if exists "sparat photos upload" on storage.objects;
drop policy if exists "sparat photos delete" on storage.objects;
-- the public bucket serves images to everyone; this only lets owners see (and so delete) their own files
create policy "sparat photos select" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "sparat photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sparat photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- 7) البحث والإحصائيات ----------
-- (إعدادات الشركة والزبائن تُنشأ هنا لأن دالة البحث تعتمد عليها؛ التفاصيل في القسم 8)
alter table public.settings add column if not exists price_mode text not null default 'all';
do $$ begin
  alter table public.settings add constraint settings_price_mode_chk check (price_mode in ('all', 'members', 'approved', 'hidden'));
exception when duplicate_object then null; end $$;
alter table public.products add column if not exists hide_price boolean not null default false;
create table if not exists public.customers (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 80),
  phone      text not null default '' check (char_length(phone) <= 30),
  city       text not null default '' check (char_length(city) <= 40),
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);
-- a merchant signs up with the name of his shop (section 16)
alter table public.customers add column if not exists shop_name text not null default '' check (char_length(shop_name) <= 80);
alter table public.products add column if not exists barcode text check (barcode is null or char_length(barcode) <= 60);
alter table public.products add column if not exists cost numeric(12,2) check (cost is null or (cost >= 0 and cost <= 99999999));
create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(email) and char_length(email) between 5 and 200),
  user_id    uuid unique references auth.users(id) on delete set null,
  name       text not null default '' check (char_length(name) <= 80),
  perms      text[] not null default '{}',
  branch_id  uuid references public.shops(id) on delete set null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
-- the most this employee may take off an invoice, as a % of it (null = no limit)
alter table public.staff add column if not exists max_discount numeric(5,2) check (max_discount is null or (max_discount >= 0 and max_discount <= 100));
-- the AI assistant (section 14): given by the manager, and what it may do for this person (a part of their own permissions)
alter table public.staff add column if not exists ai_on boolean not null default false;
alter table public.staff add column if not exists ai_perms text[] not null default '{}';
create or replace function public.has_perm(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.staff where user_id = auth.uid() and active and p = any (perms));
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.staff where user_id = auth.uid() and active);
$$;
create or replace function public.customer_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.customers where user_id = auth.uid() and approved);
$$;
drop function if exists public.search_products(text[], integer[], text, text, text, text, integer, text, uuid, text, text, integer, boolean, uuid[], boolean, text, integer, integer);
drop function if exists public.search_products(text[], integer[], text, text, text, text, integer, text, uuid, text, text, integer, boolean, uuid[], boolean, text, integer, integer, text);
create function public.search_products(
  p_patterns     text[]   default null,
  p_years        integer[] default null,
  p_cat          text     default null,
  p_cond         text     default null,
  p_make         text     default null,
  p_model        text     default null,
  p_year         integer  default null,
  p_city         text     default null,
  p_shop         uuid     default null,
  p_fit_make     text     default null,
  p_fit_model    text     default null,
  p_fit_year     integer  default null,
  p_fit_strict   boolean  default false,
  p_ids          uuid[]   default null,
  p_include_sold boolean  default false,
  p_sort         text     default 'new',
  p_limit        integer  default 24,
  p_offset       integer  default 0,
  p_country      text     default null
) returns setof jsonb
language sql stable security definer set search_path = public as $$
  with ctx as (
    select public.is_admin() as adm, auth.uid() as me, public.customer_approved() as appr,
           public.is_staff() as stf, public.has_perm('costs') as costs,
           coalesce((select price_mode from public.settings where id = 1), 'all') as mode,
           coalesce((select hide_qty from public.settings where id = 1), false) as hideq
  )
  select (to_jsonb(p) - 'search_text' - 'price' - 'cost' - 'qty') || jsonb_build_object(
           'price', case when v.ok then p.price end,
           'qty', case when ctx.hideq and not (ctx.adm or ctx.stf or (ctx.me is not null and ctx.me = p.owner_id)) then null else p.qty end,
           'cost', case when ctx.costs then p.cost end,
           'price_hidden', (p.price is not null and not v.ok),
           'shop', jsonb_build_object(
             'id', s.id, 'name', s.name, 'city', s.city, 'area', s.area, 'hours', s.hours,
             'whatsapp', s.whatsapp, 'phone', s.phone, 'logo', s.logo,
             'verified', s.verified, 'owner_id', s.owner_id,
             'country', s.country, 'currency', s.currency),
           'total_count', count(*) over ())
  from public.products p
  join public.shops s on s.id = p.shop_id
  cross join ctx
  cross join lateral (select (ctx.adm or ctx.stf or (ctx.me is not null and ctx.me = p.owner_id)
      or (not p.hide_price and (ctx.mode = 'all' or (ctx.mode = 'members' and ctx.me is not null)
                                or (ctx.mode = 'approved' and ctx.appr)))) as ok) v
  where (p_include_sold or p.status = 'active')
    and (p_ids is null or p.id = any (p_ids))
    and (p_country is null or s.country = p_country)
    and (p_shop is null or p.shop_id = p_shop)
    and (p_city is null or s.city = p_city)
    and (p_cat  is null or p.cat = p_cat)
    and (p_cond is null or p.cond = p_cond)
    and (p_make is null or p.make = p_make)
    and (p_model is null or p.model = '' or p.model = p_model)
    and (p_year is null or ((p.y_from is null or p.y_from <= p_year) and (p.y_to is null or p.y_to >= p_year)))
    and (p_fit_make is null
         or (p.make = 'any' and not p_fit_strict)
         or (p.make = p_fit_make
             and (p_fit_model is null or p.model = '' or p.model = p_fit_model)
             and (p_fit_year is null or ((p.y_from is null or p.y_from <= p_fit_year)
                                         and (p.y_to is null or p.y_to >= p_fit_year)))))
    and (p_patterns is null or not exists (
          select 1 from unnest(p_patterns) as pat where p.search_text !~ pat))
    and (p_years is null or not exists (
          select 1 from unnest(p_years) as y
          where (p.y_from is not null or p.y_to is not null)
            and not ((p.y_from is null or p.y_from <= y) and (p.y_to is null or p.y_to >= y))))
  order by
    case when p_sort = 'cheap' and v.ok then p.price end asc nulls last,
    case when p_sort = 'exp' and v.ok then p.price end desc nulls last,
    p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

drop function if exists public.store_stats(text, uuid);
drop function if exists public.store_stats(text, uuid, text);
create function public.store_stats(p_city text default null, p_shop uuid default null, p_country text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with sh as (
    select id, city from public.shops
    where (p_country is null or country = p_country)
      and (p_city is null or city = p_city) and (p_shop is null or id = p_shop)
  ), pr as (
    select p.cat, p.status, p.imgs from public.products p join sh on sh.id = p.shop_id
  )
  select jsonb_build_object(
    'shops',     (select count(*) from sh),
    'products',  (select count(*) from pr where status = 'active'),
    'sold',      (select count(*) from pr where status = 'sold'),
    'noimg',     (select count(*) from pr where cardinality(imgs) = 0),
    'cities',    (select count(distinct city) from public.shops where p_country is null or country = p_country),
    'countries', (select count(distinct country) from public.shops),
    'cats',      coalesce((select jsonb_object_agg(cat, n)
                           from (select cat, count(*) as n from pr where status = 'active' group by cat) t),
                          '{}'::jsonb)
  );
$$;

drop function if exists public.list_shops(text, text, uuid, text, integer, integer);
drop function if exists public.list_shops(text, text, uuid, text, integer, integer, text);
create function public.list_shops(
  p_q       text    default null,
  p_city    text    default null,
  p_owner   uuid    default null,
  p_make    text    default null,
  p_limit   integer default 40,
  p_offset  integer default 0,
  p_country text    default null
) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) || jsonb_build_object(
           'product_count', c.active, 'sold_count', c.sold, 'noimg_count', c.noimg,
           'last_at', c.last_at, 'total_count', count(*) over ())
  from public.shops s
  cross join lateral (
    select count(*) filter (where p.status = 'active') as active,
           count(*) filter (where p.status = 'sold')   as sold,
           count(*) filter (where cardinality(p.imgs) = 0) as noimg,
           max(p.created_at) as last_at
    from public.products p where p.shop_id = s.id
  ) c
  where (p_country is null or s.country = p_country)
    and (p_city  is null or s.city = p_city)
    and (p_owner is null or s.owner_id = p_owner)
    and (p_make  is null or p_make = any (s.makes))
    and (p_q is null
         or public.norm_ar(s.name)  like '%' || public.norm_ar(p_q) || '%'
         or public.norm_ar(s.area)  like '%' || public.norm_ar(p_q) || '%'
         or public.norm_ar(s.about) like '%' || public.norm_ar(p_q) || '%')
  order by s.verified desc, c.active desc, s.created_at desc, s.id
  limit least(greatest(coalesce(p_limit, 40), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- المدن التي فيها محلات في دولة معيّنة، الأكثر محلات أولاً
drop function if exists public.list_cities(text);
create function public.list_cities(p_country text default null)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('city', city, 'shops', count(*))
  from public.shops
  where p_country is null or country = p_country
  group by city
  order by count(*) desc, city
  limit 300;
$$;

-- عدد المحلات والقطع في كل دولة (لقائمة الدول)
drop function if exists public.country_stats();
create function public.country_stats()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('country', s.country, 'shops', count(distinct s.id),
                            'products', count(p.id) filter (where p.status = 'active'))
  from public.shops s
  left join public.products p on p.shop_id = s.id
  group by s.country
  order by count(distinct s.id) desc, s.country;
$$;

grant execute on function public.search_products(text[], integer[], text, text, text, text, integer, text, uuid, text, text, integer, boolean, uuid[], boolean, text, integer, integer, text) to anon, authenticated;
grant execute on function public.store_stats(text, uuid, text) to anon, authenticated;
grant execute on function public.list_shops(text, text, uuid, text, integer, integer, text) to anon, authenticated;
grant execute on function public.list_cities(text) to anon, authenticated;
grant execute on function public.country_stats() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.norm_ar(text) to anon, authenticated;

-- ---------- 8) نسخة الشركة: إعدادات المالك، إخفاء الأسعار، الزبائن، الربط مع منظومة المبيعات ----------
alter table public.settings add column if not exists brand_name     text    not null default '' check (char_length(brand_name) <= 60);
alter table public.settings add column if not exists tagline        text    not null default '' check (char_length(tagline) <= 120);
alter table public.settings add column if not exists logo           text    not null default '' check (char_length(logo) <= 500);
alter table public.settings add column if not exists accent         text    not null default '' check (accent = '' or accent ~ '^#[0-9a-fA-F]{6}$');
alter table public.settings add column if not exists hero_title     text    not null default '' check (char_length(hero_title) <= 80);
alter table public.settings add column if not exists hero_sub       text    not null default '' check (char_length(hero_sub) <= 240);
alter table public.settings add column if not exists about          text    not null default '' check (char_length(about) <= 4000);
alter table public.settings add column if not exists contact_wa     text    not null default '' check (char_length(contact_wa) <= 30);
alter table public.settings add column if not exists contact_phone  text    not null default '' check (char_length(contact_phone) <= 30);
alter table public.settings add column if not exists address        text    not null default '' check (char_length(address) <= 200);
alter table public.settings add column if not exists open_signup    boolean not null default true;
alter table public.settings add column if not exists orders_enabled boolean not null default false;
alter table public.settings add column if not exists brands         text[]  not null default '{}';
-- the logo picture the company uploaded for a brand, by brand id ({"kia": "https://…/photos/…jpg"}); shown instead of the brand's initials
alter table public.settings add column if not exists brand_logos    jsonb   not null default '{}'::jsonb check (jsonb_typeof(brand_logos) = 'object' and octet_length(brand_logos::text) <= 40000);
-- الرد الآلي: رسالة الترحيب وقواعد «كلمات ← رد» يكتبها المالك
alter table public.settings add column if not exists bot_enabled    boolean not null default true;
alter table public.settings add column if not exists bot_welcome    text    not null default '' check (char_length(bot_welcome) <= 400);
alter table public.settings add column if not exists bot_rules      jsonb   not null default '[]'::jsonb check (jsonb_typeof(bot_rules) = 'array' and octet_length(bot_rules::text) <= 20000);

-- رقم الصنف في منظومة المبيعات (فريد)، يُستخدم للربط
alter table public.products add column if not exists sku text;
do $$ begin
  alter table public.products add constraint products_sku_chk check (sku is null or char_length(sku) between 1 and 60);
exception when duplicate_object then null; end $$;
create unique index if not exists products_sku_key on public.products (sku);

-- القطع لا تُقرأ مباشرة إلا للإدارة وصاحبها؛ الزبائن يقرؤونها عبر دوال البحث التي تخفي السعر حسب الإعداد
drop policy if exists "sparat products read" on public.products;
create policy "sparat products read" on public.products for select using (public.is_admin() or owner_id = auth.uid());
-- تسجيل محلات جديدة مفتوح للجميع أو للإدارة فقط (نسخة الشركة: الفروع تضيفها الإدارة)
drop policy if exists "sparat shops insert" on public.shops;
create policy "sparat shops insert" on public.shops for insert to authenticated
  with check ((owner_id = auth.uid() and coalesce((select open_signup from public.settings where id = 1), true)) or public.is_admin());

-- الزبائن: كل زبون يرى ويعدّل بياناته فقط، والموافقة للإدارة
alter table public.customers enable row level security;
create or replace function public.customers_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then new.user_id := auth.uid(); new.approved := false; new.created_at := now();
    else new.user_id := old.user_id; new.approved := old.approved; new.created_at := old.created_at; end if;
  end if;
  return new;
end $$;
drop trigger if exists customers_guard on public.customers;
create trigger customers_guard before insert or update on public.customers for each row execute function public.customers_guard();
drop policy if exists "sparat customers read" on public.customers;
drop policy if exists "sparat customers insert" on public.customers;
drop policy if exists "sparat customers update" on public.customers;
drop policy if exists "sparat customers delete" on public.customers;
create policy "sparat customers read"   on public.customers for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "sparat customers insert" on public.customers for insert to authenticated with check (user_id = auth.uid());
create policy "sparat customers update" on public.customers for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "sparat customers delete" on public.customers for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- مفتاح الربط مع منظومة المبيعات (يُحفظ مشفّراً في جدول لا يقرؤه أحد)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.app_secrets (id integer primary key default 1 check (id = 1), sync_key_hash text not null default '');
alter table public.app_secrets enable row level security;
insert into public.app_secrets (id) values (1) on conflict (id) do nothing;
revoke all on public.app_secrets from anon, authenticated;

create or replace function public.try_num(t text) returns numeric language plpgsql immutable as $$
begin
  return nullif(replace(replace(btrim(coalesce(t, '')), ',', '.'), ' ', ''), '')::numeric;
exception when others then return null;
end $$;

create or replace function public.rotate_sync_key() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  k := encode(extensions.gen_random_bytes(24), 'hex');
  update public.app_secrets set sync_key_hash = encode(extensions.digest(k, 'sha256'), 'hex') where id = 1;
  return k;
end $$;

-- تحديث القطع من منظومة المبيعات: كل صف {sku, title, price, qty, make, model, cat, cond, part_no}
-- صنف جديد يُضاف، وصنف موجود يتحدث سعره وكميته؛ الكمية صفر = «نفدت».
create or replace function public.upsert_products_internal(p_rows jsonb, p_shop uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  h text; v_shop uuid; v_owner uuid; r jsonb; v_sku text; v_id uuid; v_title text;
  v_price numeric; v_qty integer; v_make text; v_cat text; v_cond text; v_bar text;
  n_ins integer := 0; n_upd integer := 0; n_skip integer := 0; n_err integer := 0;
begin
  perform set_config('sparat.ctx', 'sync', true);
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'p_rows must be a JSON array of at most 2000 items';
  end if;
  v_shop := coalesce(p_shop,
    (select s.id from public.shops s join public.admins a on a.user_id = s.owner_id order by s.created_at limit 1),
    (select id from public.shops order by created_at limit 1));
  select owner_id into v_owner from public.shops where id = v_shop;
  if v_owner is null then raise exception 'create a branch first'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    begin
      v_sku := nullif(left(btrim(coalesce(r->>'sku', '')), 60), '');
      if v_sku is null then n_skip := n_skip + 1; continue; end if;
      v_title := left(btrim(coalesce(r->>'title', '')), 120);
      v_price := public.try_num(r->>'price');
      if v_price is not null and (v_price < 0 or v_price > 99999999) then v_price := null; end if;
      v_qty := floor(public.try_num(r->>'qty'))::integer;
      if v_qty is not null and (v_qty < 0 or v_qty > 999999) then v_qty := greatest(least(v_qty, 999999), 0); end if;
      v_make := nullif(left(lower(btrim(coalesce(r->>'make', ''))), 20), '');
      v_cat := case when r->>'cat' in ('engine','brakes','suspension','electrical','lights','body','oils','cooling','ac','transmission','tires','interior','other') then r->>'cat' end;
      v_cond := case when r->>'cond' in ('original','aftermarket','used','refurb') then r->>'cond' end;
      v_bar := nullif(left(btrim(coalesce(r->>'barcode', '')), 60), '');
      select id into v_id from public.products where sku = v_sku;
      if v_id is null then
        if char_length(v_title) < 2 then n_skip := n_skip + 1; continue; end if;
        insert into public.products (shop_id, owner_id, sku, barcode, title, cat, cond, price, qty, make, model, part_no, status)
        values (v_shop, v_owner, v_sku, v_bar, v_title, coalesce(v_cat, 'other'), coalesce(v_cond, 'original'), v_price, v_qty,
                coalesce(v_make, 'any'), left(coalesce(r->>'model', ''), 60), left(coalesce(nullif(r->>'part_no', ''), v_sku), 60),
                case when v_qty is not null and v_qty <= 0 then 'sold' else 'active' end);
        n_ins := n_ins + 1;
      else
        update public.products set
          title  = case when char_length(v_title) >= 2 then v_title else title end,
          price  = case when r ? 'price' then v_price else price end,
          qty    = case when r ? 'qty' then v_qty else qty end,
          status = case when r ? 'qty' and v_qty is not null then (case when v_qty <= 0 then 'sold' else 'active' end) else status end,
          make   = coalesce(v_make, make),
          model  = case when r ? 'model' then left(coalesce(r->>'model', ''), 60) else model end,
          cat    = coalesce(v_cat, cat),
          cond   = coalesce(v_cond, cond),
          barcode = coalesce(v_bar, barcode),
          search_text = case when (char_length(v_title) >= 2 and v_title <> title) or (v_make is not null and v_make <> make)
                               or (v_bar is not null and v_bar is distinct from barcode) then '' else search_text end
        where id = v_id;
        n_upd := n_upd + 1;
      end if;
    exception when others then n_err := n_err + 1;
    end;
  end loop;
  return jsonb_build_object('inserted', n_ins, 'updated', n_upd, 'skipped', n_skip, 'errors', n_err);
end $$;

create or replace function public.sync_products(p_key text, p_rows jsonb, p_shop uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h text; r jsonb;
begin
  select sync_key_hash into h from public.app_secrets where id = 1;
  if coalesce(h, '') = '' or coalesce(p_key, '') = '' or encode(extensions.digest(p_key, 'sha256'), 'hex') <> h then
    raise exception 'invalid sync key' using errcode = '42501';
  end if;
  r := public.upsert_products_internal(p_rows, p_shop);
  perform public.log_act('sync', '', '', null, r);
  return r;
end $$;

-- رفع ملف Excel/CSV من لوحة الإدارة (بدون مفتاح، للإدارة فقط)
create or replace function public.import_products(p_rows jsonb, p_shop uuid default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  r := public.upsert_products_internal(p_rows, p_shop);
  perform public.log_act('import', '', '', null, r);
  return r;
end $$;
revoke execute on function public.upsert_products_internal(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.import_products(jsonb, uuid) to authenticated;


grant execute on function public.customer_approved() to anon, authenticated;
grant execute on function public.rotate_sync_key() to authenticated;
grant execute on function public.sync_products(text, jsonb, uuid) to anon, authenticated;
grant select, insert, update, delete on public.customers to authenticated;

-- ---------- 9) منظومة المبيعات: الموظفون والصلاحيات، الفواتير، المرتجعات، التقارير ----------
alter table public.staff enable row level security;
drop policy if exists "sparat staff admin" on public.staff;
drop policy if exists "sparat staff self" on public.staff;
create policy "sparat staff admin" on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sparat staff self" on public.staff for select to authenticated using (user_id = auth.uid());

-- الموظف يُربط بحسابه تلقائياً عند التسجيل بنفس البريد
create or replace function public.sparat_link_staff() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.staff set user_id = new.id where email = lower(new.email) and user_id is null;
  return new;
end $$;
drop trigger if exists sparat_link_staff on auth.users;
create trigger sparat_link_staff after insert on auth.users for each row execute function public.sparat_link_staff();

create or replace function public.my_perms() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'admin', public.is_admin(),
    'staff', exists (select 1 from public.staff where user_id = auth.uid() and active),
    'perms', coalesce((select to_jsonb(perms) from public.staff where user_id = auth.uid() and active), '[]'::jsonb),
    'branch', (select branch_id from public.staff where user_id = auth.uid() and active),
    'max_discount', (select max_discount from public.staff where user_id = auth.uid() and active),
    'name', (select name from public.staff where user_id = auth.uid()),
    -- the AI assistant: the manager always; an employee when the manager gave it, doing only what he chose of their permissions
    'ai', public.is_admin() or exists (select 1 from public.staff where user_id = auth.uid() and active and ai_on),
    'ai_perms', case when public.is_admin() then to_jsonb(array['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'purchases', 'customers', 'reports', 'costs', 'expenses', 'settings'])
      else coalesce((select to_jsonb(array(select x from unnest(ai_perms) x where x = any (perms))) from public.staff where user_id = auth.uid() and active and ai_on), '[]'::jsonb) end);
$$;

drop function if exists public.save_staff(text, text, text[], uuid, boolean);
drop function if exists public.save_staff(text, text, text[], uuid, boolean, numeric);
-- p_ai_on / p_ai_perms: the AI assistant for this person (null keeps what they have); its permissions stay within theirs
create or replace function public.save_staff(p_email text, p_name text, p_perms text[], p_branch uuid default null, p_active boolean default true, p_max_discount numeric default null,
                                             p_ai_on boolean default null, p_ai_perms text[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_perms text[]; r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email' using errcode = '22023'; end if;
  v_perms := array(select distinct x from unnest(coalesce(p_perms, '{}')) x
                   where x in ('sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'customers', 'reports', 'costs', 'settings', 'purchases', 'expenses'));
  if p_max_discount is not null and (p_max_discount < 0 or p_max_discount > 100) then raise exception 'bad discount limit' using errcode = '22023'; end if;
  insert into public.staff as st (email, name, perms, branch_id, active, user_id, max_discount, ai_on, ai_perms)
  values (v_email, left(coalesce(p_name, ''), 80), v_perms, p_branch, coalesce(p_active, true), (select id from auth.users where lower(email) = v_email limit 1), p_max_discount,
          coalesce(p_ai_on, false), array(select distinct x from unnest(coalesce(p_ai_perms, '{}')) x where x = any (v_perms)))
  on conflict (email) do update set name = excluded.name, perms = excluded.perms, branch_id = excluded.branch_id,
    active = excluded.active, user_id = coalesce(st.user_id, excluded.user_id), max_discount = excluded.max_discount,
    ai_on = coalesce(p_ai_on, st.ai_on),
    ai_perms = array(select distinct x from unnest(coalesce(p_ai_perms, st.ai_perms)) x where x = any (excluded.perms))
  returning to_jsonb(st.*) into r;
  return r;
end $$;
create or replace function public.delete_staff(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.staff where id = p_id;
end $$;

-- صلاحيات الموظفين على القطع والزبائن والإعدادات
drop policy if exists "sparat products read" on public.products;
create policy "sparat products read" on public.products for select using (public.is_staff() or owner_id = auth.uid());
drop policy if exists "sparat products insert" on public.products;
create policy "sparat products insert" on public.products for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = auth.uid() or public.has_perm('products'))));
drop policy if exists "sparat products update" on public.products;
create policy "sparat products update" on public.products for update to authenticated
  using (owner_id = auth.uid() or public.has_perm('products')) with check (owner_id = auth.uid() or public.has_perm('products'));
drop policy if exists "sparat products delete" on public.products;
create policy "sparat products delete" on public.products for delete to authenticated using (owner_id = auth.uid() or public.has_perm('products'));
create or replace function public.customers_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.has_perm('customers')) then
    if tg_op = 'INSERT' then new.user_id := auth.uid(); new.approved := false; new.created_at := now();
    else
      new.user_id := old.user_id; new.created_at := old.created_at;
      -- an approved merchant sees every sale under his phone number (section 16): a new number needs the company's approval again
      new.approved := old.approved and public.cust_key('', new.phone) is not distinct from public.cust_key('', old.phone);
    end if;
  end if;
  return new;
end $$;
drop policy if exists "sparat customers read" on public.customers;
drop policy if exists "sparat customers update" on public.customers;
create policy "sparat customers read" on public.customers for select to authenticated using (user_id = auth.uid() or public.has_perm('customers') or public.has_perm('sales'));
create policy "sparat customers update" on public.customers for update to authenticated
  using (user_id = auth.uid() or public.has_perm('customers')) with check (user_id = auth.uid() or public.has_perm('customers'));
drop policy if exists "sparat settings admin" on public.settings;
create policy "sparat settings admin" on public.settings for update to authenticated using (public.has_perm('settings')) with check (public.has_perm('settings'));

-- الفواتير
create sequence if not exists public.invoice_no_seq;
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  no             bigint not null unique default nextval('public.invoice_no_seq'),
  branch_id      uuid references public.shops(id) on delete set null,
  staff_id       uuid references auth.users(id) on delete set null,
  staff_name     text not null default '',
  customer_id    uuid references auth.users(id) on delete set null,
  customer_name  text not null default '' check (char_length(customer_name) <= 80),
  customer_phone text not null default '' check (char_length(customer_phone) <= 30),
  subtotal       numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  paid           numeric(12,2) not null default 0,
  payment        text not null default 'cash' check (payment in ('cash', 'card', 'transfer', 'credit')),
  currency       text not null default 'LYD',
  status         text not null default 'done' check (status in ('done', 'returned')),
  note           text not null default '' check (char_length(note) <= 500),
  created_at     timestamptz not null default now(),
  returned_at    timestamptz
);
create index if not exists invoices_created_idx on public.invoices (created_at desc);
create index if not exists invoices_staff_idx on public.invoices (staff_id);
create table if not exists public.invoice_items (
  id         bigserial primary key,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku        text,
  title      text not null,
  qty        integer not null check (qty > 0),
  price      numeric(12,2) not null,
  cost       numeric(12,2),
  line_total numeric(12,2) not null
);
create index if not exists invoice_items_inv_idx on public.invoice_items (invoice_id);
-- customer orders from the app (section 15): an invoice «قيد التجهيز» → «قيد الاستلام» → «تم الاستلام», or «ملغي»
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (status in ('done', 'returned', 'preparing', 'ready', 'cancelled'));
alter table public.invoices add column if not exists source text not null default 'pos';
do $$ begin
  alter table public.invoices add constraint invoices_source_chk check (source in ('pos', 'app'));
exception when duplicate_object then null; end $$;
alter table public.invoices add column if not exists ordered_at    timestamptz;
alter table public.invoices add column if not exists ready_at      timestamptz;
alter table public.invoices add column if not exists cancelled_at  timestamptz;
alter table public.invoices add column if not exists cancel_reason text not null default '' check (char_length(cancel_reason) <= 200);
alter table public.invoices add column if not exists delivery      text not null default '' check (delivery in ('', 'pickup', 'delivery'));
alter table public.invoices add column if not exists address       text not null default '' check (char_length(address) <= 300);
-- the invoice sent to the merchant's account in the app (section 16)
alter table public.invoices add column if not exists sent_at timestamptz;
create index if not exists invoices_orders_idx on public.invoices (status, ordered_at) where source = 'app';
create index if not exists invoices_sent_idx on public.invoices (customer_id, sent_at desc) where sent_at is not null;
create index if not exists invoices_customer_idx on public.invoices (customer_id, created_at desc) where customer_id is not null;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
drop policy if exists "sparat invoices read" on public.invoices;
create policy "sparat invoices read" on public.invoices for select to authenticated using (public.has_perm('invoices') or staff_id = auth.uid());
drop policy if exists "sparat invoice items read" on public.invoice_items;
create policy "sparat invoice items read" on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and (public.has_perm('invoices') or i.staff_id = auth.uid())));

create or replace function public.get_invoice(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(i) || jsonb_build_object(
    'branch', (select jsonb_build_object('id', s.id, 'name', s.name, 'city', s.city, 'area', s.area, 'phone', s.phone, 'whatsapp', s.whatsapp) from public.shops s where s.id = i.branch_id),
    -- the merchant's account the invoice belongs to (an app order, or an invoice sent to it)
    'merchant', (select jsonb_build_object('user_id', c.user_id, 'shop_name', c.shop_name, 'name', c.name, 'phone', c.phone, 'approved', c.approved)
                 from public.customers c where c.user_id = i.customer_id),
    'items', coalesce((select jsonb_agg((to_jsonb(it) - 'cost') || case when public.has_perm('costs') then jsonb_build_object('cost', it.cost) else '{}'::jsonb end order by it.id)
                       from public.invoice_items it where it.invoice_id = i.id), '[]'::jsonb))
  from public.invoices i
  where i.id = p_id and auth.uid() is not null and (public.has_perm('invoices') or i.staff_id = auth.uid() or (i.source = 'app' and public.has_perm('sales')));
$$;

-- إنشاء فاتورة: يقفل صفوف القطع، يتحقق من المخزون والصلاحيات، وينقص الكمية في نفس العملية
create or replace function public.create_invoice(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); v_staff public.staff; v_branch uuid; v_it jsonb; v_p public.products; v_qty integer; v_price numeric;
  v_sub numeric := 0; v_disc numeric := coalesce(public.try_num(p->>'discount'), 0); v_lines jsonb := '[]'::jsonb;
  v_pay text := coalesce(nullif(p->>'payment', ''), 'cash'); v_cur text; v_name text; v_id uuid; v_paid numeric;
  v_list numeric := 0; v_costsum numeric := 0; v_units integer := 0; v_adm boolean := public.is_admin(); v_nbc boolean;
begin
  if v_me is null or not public.has_perm('sales') then raise exception 'not authorized' using errcode = '42501'; end if;
  perform set_config('sparat.ctx', 'sale', true);
  -- the owner's rules bind the staff, not the owner
  v_nbc := not v_adm and coalesce((select no_below_cost from public.settings where id = 1), false);
  select * into v_staff from public.staff where user_id = v_me and active;
  v_branch := coalesce(v_staff.branch_id, nullif(p->>'branch', '')::uuid);
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 or jsonb_array_length(p->'items') > 200 then
    raise exception 'invoice needs 1 to 200 items' using errcode = '22023';
  end if;
  if v_pay not in ('cash', 'card', 'transfer', 'credit') then v_pay := 'cash'; end if;
  for v_it in select value from jsonb_array_elements(p->'items') loop
    v_qty := floor(coalesce(public.try_num(v_it->>'qty'), 0))::integer;
    if v_qty < 1 or v_qty > 100000 then raise exception 'bad quantity' using errcode = '22023'; end if;
    select * into v_p from public.products where id = (v_it->>'id')::uuid for update;
    if v_p.id is null then raise exception 'part not found' using errcode = 'P0001'; end if;
    v_price := case when public.has_perm('prices') and public.try_num(v_it->>'price') is not null then public.try_num(v_it->>'price') else v_p.price end;
    if v_price is null or v_price < 0 then raise exception 'part has no price: %', v_p.title using errcode = 'P0001'; end if;
    if v_nbc and v_p.cost is not null and v_price < v_p.cost then raise exception 'below cost: %', v_p.title using errcode = 'P0001'; end if;
    if v_p.qty is not null and v_p.qty < v_qty then raise exception 'not enough stock: % (available %)', v_p.title, v_p.qty using errcode = 'P0001'; end if;
    v_list := v_list + coalesce(v_p.price, v_price) * v_qty; v_costsum := v_costsum + coalesce(v_p.cost, 0) * v_qty; v_units := v_units + v_qty;
    update public.products set
      qty = case when qty is null then null else qty - v_qty end,
      status = case when qty is not null and qty - v_qty <= 0 then 'sold' else status end
    where id = v_p.id;
    v_sub := v_sub + v_price * v_qty;
    v_lines := v_lines || jsonb_build_object('product_id', v_p.id, 'sku', coalesce(v_p.sku, nullif(v_p.part_no, '')), 'title', v_p.title,
                                             'qty', v_qty, 'price', v_price, 'cost', v_p.cost, 'line_total', v_price * v_qty);
    v_branch := coalesce(v_branch, v_p.shop_id);
  end loop;
  if v_disc < 0 or v_disc > v_sub then raise exception 'bad discount' using errcode = '22023'; end if;
  if v_disc > 0 and not public.has_perm('discounts') then raise exception 'not authorized to give discounts' using errcode = '42501'; end if;
  -- the limit counts everything taken off the list prices: a lower price on a line and the discount on the invoice
  if not v_adm and v_staff.max_discount is not null and v_list - (v_sub - v_disc) > round(v_list * v_staff.max_discount / 100, 2) then
    raise exception 'discount over limit: %', v_staff.max_discount using errcode = 'P0001';
  end if;
  if v_nbc and v_sub - v_disc < v_costsum then raise exception 'below cost' using errcode = 'P0001'; end if;
  select currency into v_cur from public.shops where id = v_branch;
  v_name := coalesce(nullif(v_staff.name, ''), (select email from auth.users where id = v_me), '');
  v_paid := coalesce(public.try_num(p->>'paid'), case when v_pay = 'credit' then 0 else v_sub - v_disc end);
  insert into public.invoices (branch_id, staff_id, staff_name, customer_id, customer_name, customer_phone, subtotal, discount, total, paid, payment, currency, note)
  values (v_branch, v_me, v_name, nullif(p->>'customer_id', '')::uuid, left(coalesce(p->>'customer_name', ''), 80), left(coalesce(p->>'customer_phone', ''), 30),
          v_sub, v_disc, v_sub - v_disc, greatest(v_paid, 0), v_pay, coalesce(v_cur, 'LYD'), left(coalesce(p->>'note', ''), 500))
  returning id into v_id;
  insert into public.invoice_items (invoice_id, product_id, sku, title, qty, price, cost, line_total)
  select v_id, (x->>'product_id')::uuid, x->>'sku', x->>'title', (x->>'qty')::integer, (x->>'price')::numeric, (x->>'cost')::numeric, (x->>'line_total')::numeric
  from jsonb_array_elements(v_lines) x;
  perform public.log_act('sale', v_id::text, nullif(btrim(coalesce(p->>'customer_name', '')), ''), v_sub - v_disc,
    jsonb_build_object('no', (select no from public.invoices where id = v_id), 'units', v_units, 'lines', jsonb_array_length(v_lines), 'discount', v_disc,
                       'off_list', greatest(v_list - v_sub, 0), 'payment', v_pay, 'paid', greatest(v_paid, 0)));
  return public.get_invoice(v_id);
end $$;

-- مرتجع: الفاتورة كاملة ترجع والكميات تنضاف للمخزون
create or replace function public.return_invoice(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.has_perm('returns') then raise exception 'not authorized' using errcode = '42501'; end if;
  select status into v_status from public.invoices where id = p_id for update;
  if v_status is null then raise exception 'invoice not found' using errcode = 'P0001'; end if;
  if v_status = 'returned' then raise exception 'invoice already returned' using errcode = 'P0001'; end if;
  if v_status <> 'done' then raise exception 'order not received yet' using errcode = 'P0001'; end if;
  perform set_config('sparat.ctx', 'return', true);
  update public.products p set qty = p.qty + a.n, status = case when p.qty + a.n > 0 then 'active' else p.status end
  from (select product_id, sum(qty) as n from public.invoice_items where invoice_id = p_id group by product_id) a
  where p.id = a.product_id and p.qty is not null;
  update public.invoices set status = 'returned', returned_at = now() where id = p_id;
  perform public.log_act('return', p_id::text, (select nullif(btrim(customer_name), '') from public.invoices where id = p_id), (select total from public.invoices where id = p_id),
    jsonb_build_object('no', (select no from public.invoices where id = p_id)));
  return public.get_invoice(p_id);
end $$;

create or replace function public.list_invoices(p_from timestamptz default null, p_to timestamptz default null, p_branch uuid default null,
                                                p_q text default null, p_limit integer default 30, p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(i) || jsonb_build_object('branch_name', s.name,
           'items_count', (select coalesce(sum(qty), 0) from public.invoice_items where invoice_id = i.id), 'total_count', count(*) over ())
  from public.invoices i left join public.shops s on s.id = i.branch_id
  where auth.uid() is not null and (public.has_perm('invoices') or i.staff_id = auth.uid())
    and (p_from is null or i.created_at >= p_from) and (p_to is null or i.created_at < p_to)
    and (p_branch is null or i.branch_id = p_branch)
    and (coalesce(p_q, '') = '' or i.no::text = btrim(p_q) or i.customer_name ilike '%' || p_q || '%' or i.customer_phone like '%' || p_q || '%')
  order by i.created_at desc, i.no desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.sales_report(p_from timestamptz, p_to timestamptz, p_branch uuid default null, p_tz text default 'Africa/Tripoli')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_costs boolean := public.has_perm('costs');
begin
  if not public.has_perm('reports') then raise exception 'not authorized' using errcode = '42501'; end if;
  with inv as (select * from public.invoices i where i.status = 'done' and i.created_at >= p_from and i.created_at < p_to and (p_branch is null or i.branch_id = p_branch)),
       items as (select it.* from public.invoice_items it join inv on inv.id = it.invoice_id)
  select jsonb_build_object(
    'count', (select count(*) from inv),
    'total', coalesce((select sum(total) from inv), 0),
    'discount', coalesce((select sum(discount) from inv), 0),
    'credit', coalesce((select sum(total - paid) from inv where payment = 'credit'), 0),
    'returned', (select count(*) from public.invoices i where i.status = 'returned' and i.returned_at >= p_from and i.returned_at < p_to and (p_branch is null or i.branch_id = p_branch)),
    'by_payment', coalesce((select jsonb_object_agg(payment, s) from (select payment, sum(total) as s from inv group by payment) t), '{}'::jsonb),
    'by_staff', coalesce((select jsonb_agg(jsonb_build_object('name', staff_name, 'count', c, 'total', s) order by s desc) from (select staff_name, count(*) as c, sum(total) as s from inv group by staff_name) t), '[]'::jsonb),
    'by_branch', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(sh.name, '—'), 'count', t.c, 'total', t.s) order by t.s desc)
                           from (select branch_id, count(*) as c, sum(total) as s from inv group by branch_id) t left join public.shops sh on sh.id = t.branch_id), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'total', s) order by d) from (select (created_at at time zone p_tz)::date as d, sum(total) as s from inv group by 1) t), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'qty', q, 'total', s) order by q desc)
                     from (select title, sum(qty) as q, sum(line_total) as s from items group by title order by sum(qty) desc limit 10) t), '[]'::jsonb),
    'profit', case when v_costs then coalesce((select sum(line_total - coalesce(cost, 0) * qty) from items), 0) - coalesce((select sum(discount) from inv), 0) end,
    'cost_missing', case when v_costs then (select count(*) from items where cost is null) end
  ) into r;
  return r;
end $$;

grant execute on function public.my_perms() to authenticated;
grant execute on function public.save_staff(text, text, text[], uuid, boolean, numeric, boolean, text[]) to authenticated;
grant execute on function public.delete_staff(uuid) to authenticated;
grant execute on function public.get_invoice(uuid) to authenticated;
grant execute on function public.create_invoice(jsonb) to authenticated;
grant execute on function public.return_invoice(uuid) to authenticated;
grant execute on function public.list_invoices(timestamptz, timestamptz, uuid, text, integer, integer) to authenticated;
grant execute on function public.sales_report(timestamptz, timestamptz, uuid, text) to authenticated;
grant select on public.staff, public.invoices, public.invoice_items to authenticated;

-- ---------- 10) استلام البضاعة: من صورة فاتورة المورّد أو الباركود ----------
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_sku_upper_idx on public.products (upper(sku));
create index if not exists products_part_upper_idx on public.products (upper(part_no));
create sequence if not exists public.purchase_no_seq;
create table if not exists public.purchases (
  id          uuid primary key default gen_random_uuid(),
  no          bigint not null unique default nextval('public.purchase_no_seq'),
  branch_id   uuid references public.shops(id) on delete set null,
  staff_id    uuid references auth.users(id) on delete set null,
  staff_name  text not null default '',
  supplier    text not null default '' check (char_length(supplier) <= 120),
  note        text not null default '' check (char_length(note) <= 500),
  total       numeric(14,2) not null default 0,
  items_count integer not null default 0,
  created_at  timestamptz not null default now()
);
-- what was paid to the supplier on receiving; null = paid in full (also every receipt from before this column)
alter table public.purchases add column if not exists paid numeric(14,2);
create table if not exists public.purchase_items (
  id          bigserial primary key,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  code        text,
  title       text not null,
  qty         integer not null check (qty > 0),
  cost        numeric(12,2)
);
create index if not exists purchase_items_p_idx on public.purchase_items (purchase_id);
-- what a line changed, so the receipt can be taken back: the part's cost and price before it, the price it set, and whether it created the part
alter table public.purchase_items add column if not exists prev_cost  numeric(12,2);
alter table public.purchase_items add column if not exists prev_price numeric(12,2);
alter table public.purchase_items add column if not exists set_price  numeric(12,2);
alter table public.purchase_items add column if not exists created    boolean not null default false;
create index if not exists purchase_items_prod_idx on public.purchase_items (product_id);
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
drop policy if exists "sparat purchases read" on public.purchases;
create policy "sparat purchases read" on public.purchases for select to authenticated using (public.has_perm('purchases') or public.has_perm('reports'));
drop policy if exists "sparat purchase items read" on public.purchase_items;
create policy "sparat purchase items read" on public.purchase_items for select to authenticated using (public.has_perm('purchases') or public.has_perm('reports'));

-- استلام: كل سطر يطابق قطعة موجودة (بالمعرّف أو الكود أو الباركود أو رقم القطعة) فتزيد كميتها، أو تنضاف قطعة جديدة
create or replace function public.receive_stock(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); v_staff public.staff; v_branch uuid; v_owner uuid; v_it jsonb; v_id uuid; v_qty integer;
  v_cost numeric; v_price numeric; v_pid uuid; v_total numeric := 0; n_new integer := 0; n_upd integer := 0; v_code text; v_title text; v_paid numeric;
  v_sku text; v_bar text; v_pn text; v_can_price boolean := public.has_perm('products');
  v_pc numeric; v_pp numeric; v_made boolean; v_units integer := 0;
begin
  if v_me is null or not public.has_perm('purchases') then raise exception 'not authorized' using errcode = '42501'; end if;
  perform set_config('sparat.ctx', 'receive', true);
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 or jsonb_array_length(p->'items') > 300 then
    raise exception 'receipt needs 1 to 300 items' using errcode = '22023';
  end if;
  select * into v_staff from public.staff where user_id = v_me and active;
  v_branch := coalesce(v_staff.branch_id, nullif(p->>'branch', '')::uuid,
    (select s.id from public.shops s join public.admins a on a.user_id = s.owner_id order by s.created_at limit 1),
    (select id from public.shops order by created_at limit 1));
  select owner_id into v_owner from public.shops where id = v_branch;
  if v_owner is null then raise exception 'create a branch first'; end if;
  insert into public.purchases (branch_id, staff_id, staff_name, supplier, note)
  values (v_branch, v_me, coalesce(nullif(v_staff.name, ''), (select email from auth.users where id = v_me), ''), left(coalesce(p->>'supplier', ''), 120), left(coalesce(p->>'note', ''), 500))
  returning id into v_pid;
  for v_it in select value from jsonb_array_elements(p->'items') loop
    v_qty := floor(coalesce(public.try_num(v_it->>'qty'), 0))::integer;
    if v_qty < 1 or v_qty > 1000000 then raise exception 'bad quantity' using errcode = '22023'; end if;
    v_cost := public.try_num(v_it->>'cost'); v_price := public.try_num(v_it->>'price');
    if v_cost is not null and (v_cost < 0 or v_cost > 99999999) then v_cost := null; end if;
    if v_price is not null and (v_price < 0 or v_price > 99999999 or not v_can_price) then v_price := null; end if;
    v_id := nullif(v_it->>'product_id', '')::uuid; v_title := null;
    v_sku := nullif(left(btrim(coalesce(v_it->>'sku', '')), 60), '');
    v_bar := nullif(left(btrim(coalesce(v_it->>'barcode', '')), 60), '');
    v_pn  := nullif(left(upper(btrim(coalesce(v_it->>'part_no', ''))), 60), '');
    v_code := coalesce(v_sku, v_bar, v_pn);
    -- the same part: any given code as item code first, then as barcode, then as part number (this branch first)
    if v_id is null and v_code is not null then
      select id into v_id from public.products p
      where upper(p.sku) = any (array[upper(v_sku), upper(v_bar), v_pn]) or p.barcode = any (array[v_bar, v_sku, v_pn])
         or upper(p.part_no) = any (array[v_pn, upper(v_sku)])
      order by (upper(p.sku) = any (array[upper(v_sku), upper(v_bar), v_pn])) desc nulls last,
               (p.barcode = any (array[v_bar, v_sku, v_pn])) desc nulls last, (p.shop_id = v_branch) desc, p.created_at
      limit 1;
    end if;
    v_made := false; v_pc := null; v_pp := null;
    if v_id is not null then
      select cost, price into v_pc, v_pp from public.products where id = v_id for update;
      update public.products set qty = coalesce(qty, 0) + v_qty, cost = coalesce(v_cost, cost), price = coalesce(v_price, price), status = 'active'
      where id = v_id returning title into v_title;
      if v_title is null then raise exception 'part not found' using errcode = 'P0001'; end if;
      n_upd := n_upd + 1;
    else
      v_title := left(btrim(coalesce(v_it->>'title', '')), 120);
      if char_length(v_title) < 2 then raise exception 'new item needs a name' using errcode = '22023'; end if;
      insert into public.products (shop_id, owner_id, sku, barcode, title, cat, cond, price, cost, qty, make, model, part_no, status)
      values (v_branch, v_owner, v_sku, v_bar, v_title,
              case when v_it->>'cat' in ('engine','brakes','suspension','electrical','lights','body','oils','cooling','ac','transmission','tires','interior','other') then v_it->>'cat' else 'other' end,
              'original', v_price, v_cost, v_qty, coalesce(nullif(left(lower(btrim(coalesce(v_it->>'make', ''))), 20), ''), 'any'),
              left(coalesce(v_it->>'model', ''), 60), coalesce(v_pn, v_sku, ''), 'active')
      returning id into v_id;
      n_new := n_new + 1; v_made := true;
    end if;
    insert into public.purchase_items (purchase_id, product_id, code, title, qty, cost, prev_cost, prev_price, set_price, created)
    values (v_pid, v_id, v_code, v_title, v_qty, v_cost, v_pc, v_pp, v_price, v_made);
    v_total := v_total + coalesce(v_cost, 0) * v_qty; v_units := v_units + v_qty;
  end loop;
  -- paid less than the total: the rest is owed to the supplier, so the receipt needs the supplier's name
  v_paid := public.try_num(p->>'paid');
  if v_paid is not null then
    v_paid := least(greatest(v_paid, 0), v_total);
    if v_paid < v_total and public.sup_key(p->>'supplier') is null then raise exception 'supplier needed for credit' using errcode = '22023'; end if;
  end if;
  update public.purchases set total = v_total, items_count = n_new + n_upd, paid = v_paid where id = v_pid;
  perform public.log_act('receive', v_pid::text, nullif(btrim(coalesce(p->>'supplier', '')), ''), v_total,
    jsonb_build_object('no', (select no from public.purchases where id = v_pid), 'units', v_units, 'new', n_new, 'updated', n_upd, 'paid', v_paid,
                       'source', case when p->>'source' in ('photo', 'scan', 'manual') then p->>'source' end, 'auto', coalesce(p->>'auto', '') = 'true',
                       'lines', (select jsonb_agg(jsonb_build_array(title, qty, cost) order by id) from (select * from public.purchase_items where purchase_id = v_pid order by id limit 100) x)));
  return jsonb_build_object('id', v_pid, 'no', (select no from public.purchases where id = v_pid), 'new', n_new, 'updated', n_upd, 'total', v_total);
end $$;

create or replace function public.list_purchases(p_limit integer default 30, p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select (to_jsonb(pu) - 'total' - 'paid') || jsonb_build_object('total', case when public.has_perm('costs') then pu.total end,
           'paid', case when public.has_perm('costs') then coalesce(pu.paid, pu.total) end, 'branch_name', s.name, 'total_count', count(*) over (),
           'items', coalesce((select jsonb_agg(jsonb_build_object('title', it.title, 'code', it.code, 'qty', it.qty, 'cost', case when public.has_perm('costs') then it.cost end) order by it.id)
                              from public.purchase_items it where it.purchase_id = pu.id), '[]'::jsonb))
  from public.purchases pu left join public.shops s on s.id = pu.branch_id
  where auth.uid() is not null and (public.has_perm('purchases') or public.has_perm('reports'))
  order by pu.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.receive_stock(jsonb) to authenticated;
grant execute on function public.list_purchases(integer, integer) to authenticated;
grant select on public.purchases, public.purchase_items to authenticated;

-- ---------- 11) الحسابات: المخزن، الزبائن (الشاري)، الموردين (البايع)، المصروفات، الأرباح والخسائر ----------
-- Every change goes through the functions below (security definer, permission checked first); the tables are read-only to the app.
create table if not exists public.stock_moves (
  id          bigserial primary key,
  product_id  uuid references public.products(id) on delete set null,
  title       text not null,
  branch_id   uuid references public.shops(id) on delete set null,
  staff_id    uuid references auth.users(id) on delete set null,
  staff_name  text not null default '',
  qty         integer not null check (qty <> 0),                 -- + into stock, - out of stock
  reason      text not null check (reason in ('count', 'damaged', 'lost', 'other')),
  cost        numeric(12,2),                                     -- cost price of one unit at that moment
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists stock_moves_created_idx on public.stock_moves (created_at desc);
create table if not exists public.customer_payments (
  id            bigserial primary key,
  cust_key      text not null check (char_length(cust_key) between 3 and 90),
  customer_name text not null default '' check (char_length(customer_name) <= 80),
  amount        numeric(12,2) not null check (amount > 0),
  staff_id      uuid references auth.users(id) on delete set null,
  staff_name    text not null default '',
  note          text not null default '' check (char_length(note) <= 300),
  created_at    timestamptz not null default now()
);
create index if not exists customer_payments_key_idx on public.customer_payments (cust_key);
create table if not exists public.supplier_payments (
  id          bigserial primary key,
  supplier    text not null check (char_length(btrim(supplier)) between 1 and 120),
  amount      numeric(14,2) not null check (amount > 0),
  staff_id    uuid references auth.users(id) on delete set null,
  staff_name  text not null default '',
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create table if not exists public.expenses (
  id          bigserial primary key,
  branch_id   uuid references public.shops(id) on delete set null,
  cat         text not null check (cat in ('rent', 'salaries', 'utilities', 'transport', 'maintenance', 'other')),
  amount      numeric(12,2) not null check (amount > 0),
  spent_on    date not null default current_date,
  note        text not null default '' check (char_length(note) <= 300),
  staff_id    uuid references auth.users(id) on delete set null,
  staff_name  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists expenses_day_idx on public.expenses (spent_on desc);
alter table public.stock_moves enable row level security;
alter table public.customer_payments enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.expenses enable row level security;
drop policy if exists "sparat stock moves read" on public.stock_moves;
create policy "sparat stock moves read" on public.stock_moves for select to authenticated using (public.has_perm('products') or public.has_perm('reports'));
drop policy if exists "sparat customer payments read" on public.customer_payments;
create policy "sparat customer payments read" on public.customer_payments for select to authenticated using (public.has_perm('invoices') or public.has_perm('reports'));
drop policy if exists "sparat supplier payments read" on public.supplier_payments;
create policy "sparat supplier payments read" on public.supplier_payments for select to authenticated using (public.has_perm('costs'));
drop policy if exists "sparat expenses read" on public.expenses;
create policy "sparat expenses read" on public.expenses for select to authenticated using (public.has_perm('expenses') or public.has_perm('costs'));

-- One customer = one phone number (its last 9 digits, so 091… and +21891… match), or the name when the invoice has no phone.
create or replace function public.cust_key(p_name text, p_phone text) returns text language sql immutable as $$
  select case when char_length(regexp_replace(public.norm_ar(p_phone), '[^0-9]', '', 'g')) >= 7
              then 'p:' || right(regexp_replace(public.norm_ar(p_phone), '[^0-9]', '', 'g'), 9)
              when btrim(coalesce(p_name, '')) <> '' then 'n:' || left(public.norm_ar(regexp_replace(btrim(p_name), '\s+', ' ', 'g')), 80) end
$$;
-- One supplier = one name, spelled loosely (spaces, alef/ya/ta-marbuta forms and case don't matter)
create or replace function public.sup_key(p_name text) returns text language sql immutable as $$
  select nullif(left(public.norm_ar(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')), 120), '')
$$;
create index if not exists invoices_cust_idx on public.invoices (public.cust_key(customer_name, customer_phone));
create or replace function public.me_name() returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select name from public.staff where user_id = auth.uid()), ''), nullif((select name from public.customers where user_id = auth.uid()), ''),
                  (select email from auth.users where id = auth.uid()), '')
$$;

-- المخزن: summary, one page of parts, the latest changes
create or replace function public.stock_report(p_q text default null, p_filter text default 'all', p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_costs boolean := public.has_perm('costs'); v_q text := nullif(btrim(coalesce(p_q, '')), ''); r jsonb;
  v_low integer := coalesce((select low_stock from public.settings where id = 1), 3);
begin
  if auth.uid() is null or not (public.has_perm('products') or public.has_perm('purchases') or public.has_perm('reports')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  with base as (select p.*, s.name as branch_name from public.products p left join public.shops s on s.id = p.shop_id),
       hit as (select * from base b
               where (v_q is null or public.norm_ar(b.title) like '%' || public.norm_ar(v_q) || '%' or upper(coalesce(b.sku, '')) like '%' || upper(v_q) || '%'
                      or upper(b.part_no) like '%' || upper(v_q) || '%' or coalesce(b.barcode, '') = v_q)
                 and (coalesce(p_filter, 'all') not in ('low', 'out') or (p_filter = 'low' and b.qty between 1 and v_low) or (p_filter = 'out' and b.qty = 0)))
  select jsonb_build_object(
    'summary', (select jsonb_build_object('parts', count(*), 'units', coalesce(sum(qty), 0),
                  'low', count(*) filter (where qty between 1 and v_low), 'low_level', v_low, 'out', count(*) filter (where qty = 0),
                  'value_price', coalesce(sum(qty * price) filter (where qty > 0 and price is not null), 0),
                  'value_cost', case when v_costs then coalesce(sum(qty * cost) filter (where qty > 0 and cost is not null), 0) end,
                  'cost_missing', case when v_costs then count(*) filter (where qty > 0 and cost is null) end) from base),
    -- what is running low, the fewest left first, and what has run out (on the first page)
    'low_items', case when coalesce(p_offset, 0) = 0 then coalesce((select jsonb_agg(l.x order by l.qty, l.title, l.id) from (
               select jsonb_build_object('id', id, 'title', title, 'sku', sku, 'part_no', part_no, 'qty', qty, 'price', price, 'branch_name', branch_name) x, qty, title, id
               from base where qty between 1 and v_low order by qty, title, id limit 10) l), '[]'::jsonb) end,
    'out_items', case when coalesce(p_offset, 0) = 0 then coalesce((select jsonb_agg(o.x order by o.title, o.id) from (
               select jsonb_build_object('id', id, 'title', title, 'sku', sku, 'part_no', part_no, 'branch_name', branch_name) x, title, id
               from base where qty = 0 order by title, id limit 10) o), '[]'::jsonb) end,
    'total', (select count(*) from hit),
    'items', coalesce((select jsonb_agg(t.x order by t.rn) from (
               select row_number() over (order by case when p_filter = 'low' then qty end nulls first, title, id) rn, jsonb_build_object('id', id, 'title', title, 'sku', sku, 'part_no', part_no, 'barcode', barcode,
                        'qty', qty, 'price', price, 'cost', case when v_costs then cost end, 'branch_name', branch_name) x
               from hit order by case when p_filter = 'low' then qty end nulls first, title, id limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb),
    'moves', case when public.has_perm('products') or public.has_perm('reports') then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'qty', m.qty,
               'reason', m.reason, 'note', m.note, 'staff_name', m.staff_name, 'created_at', m.created_at, 'value', case when v_costs then m.qty * m.cost end) order by m.created_at desc, m.id desc)
               from (select * from public.stock_moves order by created_at desc, id desc limit 20) m), '[]'::jsonb) else '[]'::jsonb end
  ) into r;
  return r;
end $$;

-- تعديل الكمية: نقص (تالف/ضايع) أو زيادة أو جرد، ويتسجل في حركات المخزن بسعر التكلفة
create or replace function public.adjust_stock(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p public.products; v_old integer; v_new integer; v_reason text := coalesce(nullif(p->>'reason', ''), 'other');
begin
  if auth.uid() is null or not public.has_perm('products') then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_reason not in ('count', 'damaged', 'lost', 'other') then raise exception 'bad reason' using errcode = '22023'; end if;
  select * into v_p from public.products where id = nullif(p->>'id', '')::uuid for update;
  if v_p.id is null then raise exception 'part not found' using errcode = 'P0001'; end if;
  v_old := coalesce(v_p.qty, 0);
  if public.try_num(p->>'set') is not null then v_new := floor(public.try_num(p->>'set'))::integer;
  else v_new := v_old + floor(coalesce(public.try_num(p->>'delta'), 0))::integer; end if;
  if v_new < 0 then raise exception 'stock cannot go below zero (available %)', v_old using errcode = '22023'; end if;
  if v_new > 999999 then raise exception 'bad quantity' using errcode = '22023'; end if;
  if v_new = v_old then raise exception 'nothing to change' using errcode = '22023'; end if;
  perform set_config('sparat.ctx', 'stock', true);
  update public.products set qty = v_new,
    status = case when v_new = 0 then 'sold' else 'active' end
  where id = v_p.id;
  insert into public.stock_moves (product_id, title, branch_id, staff_id, staff_name, qty, reason, cost, note)
  values (v_p.id, v_p.title, v_p.shop_id, auth.uid(), public.me_name(), v_new - v_old, v_reason, v_p.cost, left(coalesce(p->>'note', ''), 300));
  perform public.log_act('stock', v_p.id::text, v_p.title, case when v_p.cost is not null then (v_new - v_old) * v_p.cost end,
    jsonb_build_object('from', v_old, 'to', v_new, 'reason', v_reason, 'note', nullif(left(coalesce(p->>'note', ''), 300), '')));
  return jsonb_build_object('id', v_p.id, 'qty', v_new, 'delta', v_new - v_old);
end $$;

-- الزبائن: every invoice with a name or phone; what is still unpaid on their invoices, minus the payments made later
create or replace function public.list_buyers(p_q text default null, p_owing boolean default false, p_limit integer default 30, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_d text; r jsonb;
begin
  if auth.uid() is null or not (public.has_perm('invoices') or public.has_perm('reports')) then raise exception 'not authorized' using errcode = '42501'; end if;
  -- a phone number is searched by its last 9 digits, like the customer key (091… and +21891… are the same)
  v_d := regexp_replace(public.norm_ar(v_q), '[^0-9]', '', 'g');
  if char_length(v_d) > 9 then v_d := right(v_d, 9); end if;
  with inv as (select public.cust_key(i.customer_name, i.customer_phone) k, i.* from public.invoices i where i.status = 'done'),
       g as (select k, (array_agg(customer_name order by created_at desc) filter (where customer_name <> ''))[1] as name,
                    (array_agg(customer_phone order by created_at desc) filter (where customer_phone <> ''))[1] as phone,
                    count(*) as n, sum(total) as total, sum(greatest(total - paid, 0)) as due, max(created_at) as last_at
             from inv where k is not null group by k),
       pay as (select cust_key k, sum(amount) as paid from public.customer_payments group by cust_key),
       b as (select g.*, coalesce(pay.paid, 0) as paid_later, g.due - coalesce(pay.paid, 0) as balance from g left join pay on pay.k = g.k),
       hit as (select * from b where (v_q is null or public.norm_ar(coalesce(b.name, '')) like '%' || public.norm_ar(v_q) || '%'
                                      or (v_d <> '' and b.k like 'p:%' || v_d || '%'))
                                 and (not coalesce(p_owing, false) or b.balance > 0))
  select jsonb_build_object(
    'owing_total', coalesce((select sum(balance) from b where balance > 0), 0), 'owing_count', (select count(*) from b where balance > 0),
    'total', (select count(*) from hit),
    'items', coalesce((select jsonb_agg(t.x order by t.rn) from (
               select row_number() over (order by (balance > 0) desc, last_at desc, k) rn,
                      jsonb_build_object('key', k, 'name', coalesce(name, phone, ''), 'phone', coalesce(phone, ''), 'count', n, 'total', total, 'due', due,
                                         'paid_later', paid_later, 'balance', balance, 'last_at', last_at) x
               from hit order by (balance > 0) desc, last_at desc, k limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;
create or replace function public.buyer_detail(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null or not (public.has_perm('invoices') or public.has_perm('reports')) then raise exception 'not authorized' using errcode = '42501'; end if;
  with inv as (select i.* from public.invoices i where public.cust_key(i.customer_name, i.customer_phone) = p_key),
       d as (select * from inv where status = 'done')
  select case when exists (select 1 from inv) then jsonb_build_object(
    'key', p_key,
    'name', coalesce((select customer_name from inv where customer_name <> '' order by created_at desc limit 1), (select customer_phone from inv where customer_phone <> '' order by created_at desc limit 1), ''),
    'phone', coalesce((select customer_phone from inv where customer_phone <> '' order by created_at desc limit 1), ''),
    'count', (select count(*) from d), 'total', coalesce((select sum(total) from d), 0), 'due', coalesce((select sum(greatest(total - paid, 0)) from d), 0),
    'paid_later', coalesce((select sum(amount) from public.customer_payments where cust_key = p_key), 0),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'no', x.no, 'created_at', x.created_at, 'total', x.total, 'paid', x.paid, 'payment', x.payment,
                   'status', x.status, 'currency', x.currency, 'staff_name', x.staff_name) order by x.created_at desc) from (select * from inv order by created_at desc limit 50) x), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'note', note, 'staff_name', staff_name, 'created_at', created_at) order by created_at desc, id desc)
                   from public.customer_payments where cust_key = p_key), '[]'::jsonb)) end into r;
  return case when r is null then null else r || jsonb_build_object('balance', (r->>'due')::numeric - (r->>'paid_later')::numeric) end;
end $$;
create or replace function public.add_customer_payment(p_key text, p_amount numeric, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if auth.uid() is null or not public.has_perm('invoices') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 99999999 then raise exception 'bad amount' using errcode = '22023'; end if;
  select coalesce(nullif(customer_name, ''), customer_phone) into v_name from public.invoices
  where public.cust_key(customer_name, customer_phone) = p_key order by created_at desc limit 1;
  if v_name is null then raise exception 'customer not found' using errcode = 'P0001'; end if;
  insert into public.customer_payments (cust_key, customer_name, amount, staff_id, staff_name, note)
  values (p_key, left(v_name, 80), round(p_amount, 2), auth.uid(), public.me_name(), left(coalesce(p_note, ''), 300));
  return public.buyer_detail(p_key);
end $$;
create or replace function public.delete_customer_payment(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.customer_payments where id = p_id;
end $$;

-- الموردين: receipts with a supplier name; what was not paid on receiving, minus the payments made later
create or replace function public.list_suppliers(p_q text default null, p_owing boolean default false, p_limit integer default 30, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), ''); r jsonb;
begin
  if auth.uid() is null or not public.has_perm('costs') then raise exception 'not authorized' using errcode = '42501'; end if;
  with pu as (select public.sup_key(x.supplier) k, x.* from public.purchases x),
       g as (select k, (array_agg(btrim(supplier) order by created_at desc))[1] as name, count(*) as n, sum(total) as total,
                    sum(total - coalesce(paid, total)) as due, max(created_at) as last_at from pu where k is not null group by k),
       pay as (select public.sup_key(supplier) k, sum(amount) as paid from public.supplier_payments group by 1),
       b as (select g.*, coalesce(pay.paid, 0) as paid_later, g.due - coalesce(pay.paid, 0) as balance from g left join pay on pay.k = g.k),
       hit as (select * from b where (v_q is null or public.norm_ar(b.name) like '%' || public.norm_ar(v_q) || '%') and (not coalesce(p_owing, false) or b.balance > 0))
  select jsonb_build_object(
    'owing_total', coalesce((select sum(balance) from b where balance > 0), 0), 'owing_count', (select count(*) from b where balance > 0),
    'total', (select count(*) from hit),
    'items', coalesce((select jsonb_agg(t.x order by t.rn) from (
               select row_number() over (order by (balance > 0) desc, last_at desc, k) rn,
                      jsonb_build_object('key', k, 'name', name, 'count', n, 'total', total, 'due', due, 'paid_later', paid_later, 'balance', balance, 'last_at', last_at) x
               from hit order by (balance > 0) desc, last_at desc, k limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;
create or replace function public.supplier_detail(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null or not public.has_perm('costs') then raise exception 'not authorized' using errcode = '42501'; end if;
  with pu as (select x.*, s.name as branch_name from public.purchases x left join public.shops s on s.id = x.branch_id where public.sup_key(x.supplier) = p_key),
       pay as (select * from public.supplier_payments where public.sup_key(supplier) = p_key)
  select case when exists (select 1 from pu) then jsonb_build_object(
    'key', p_key, 'name', (select btrim(supplier) from pu order by created_at desc limit 1),
    'count', (select count(*) from pu), 'total', coalesce((select sum(total) from pu), 0), 'due', coalesce((select sum(total - coalesce(paid, total)) from pu), 0),
    'paid_later', coalesce((select sum(amount) from pay), 0),
    'receipts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'no', x.no, 'created_at', x.created_at, 'total', x.total, 'paid', coalesce(x.paid, x.total),
                   'items_count', x.items_count, 'branch_name', x.branch_name) order by x.created_at desc) from (select * from pu order by created_at desc limit 50) x), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'note', note, 'staff_name', staff_name, 'created_at', created_at) order by created_at desc, id desc) from pay), '[]'::jsonb)
  ) end into r;
  return case when r is null then null else r || jsonb_build_object('balance', (r->>'due')::numeric - (r->>'paid_later')::numeric) end;
end $$;
create or replace function public.add_supplier_payment(p_key text, p_amount numeric, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if auth.uid() is null or not (public.has_perm('costs') and public.has_perm('purchases')) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 99999999 then raise exception 'bad amount' using errcode = '22023'; end if;
  select btrim(supplier) into v_name from public.purchases where public.sup_key(supplier) = p_key order by created_at desc limit 1;
  if v_name is null then raise exception 'supplier not found' using errcode = 'P0001'; end if;
  insert into public.supplier_payments (supplier, amount, staff_id, staff_name, note)
  values (left(v_name, 120), round(p_amount, 2), auth.uid(), public.me_name(), left(coalesce(p_note, ''), 300));
  return public.supplier_detail(p_key);
end $$;
create or replace function public.delete_supplier_payment(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.supplier_payments where id = p_id;
end $$;

-- المصروفات
create or replace function public.add_expense(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_amt numeric := public.try_num(p->>'amount'); v_cat text := coalesce(p->>'cat', 'other'); v_day date; v_branch uuid; r public.expenses;
begin
  if auth.uid() is null or not public.has_perm('expenses') then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_amt is null or v_amt <= 0 or v_amt > 99999999 then raise exception 'bad amount' using errcode = '22023'; end if;
  if v_cat not in ('rent', 'salaries', 'utilities', 'transport', 'maintenance', 'other') then v_cat := 'other'; end if;
  begin v_day := coalesce(nullif(p->>'spent_on', '')::date, current_date);
  exception when others then raise exception 'bad date' using errcode = '22023'; end;
  if v_day > current_date + 1 or v_day < current_date - 3660 then raise exception 'bad date' using errcode = '22023'; end if;
  v_branch := coalesce((select branch_id from public.staff where user_id = auth.uid() and active), nullif(p->>'branch', '')::uuid);
  insert into public.expenses (branch_id, cat, amount, spent_on, note, staff_id, staff_name)
  values (v_branch, v_cat, round(v_amt, 2), v_day, left(coalesce(p->>'note', ''), 300), auth.uid(), public.me_name())
  returning * into r;
  return to_jsonb(r) - 'staff_id';
end $$;
create or replace function public.list_expenses(p_from date default null, p_to date default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null or not (public.has_perm('expenses') or public.has_perm('costs')) then raise exception 'not authorized' using errcode = '42501'; end if;
  with e as (select x.*, s.name as branch_name from public.expenses x left join public.shops s on s.id = x.branch_id
             where (p_from is null or x.spent_on >= p_from) and (p_to is null or x.spent_on < p_to))
  select jsonb_build_object('total', (select count(*) from e), 'sum', coalesce((select sum(amount) from e), 0),
    'by_cat', coalesce((select jsonb_object_agg(cat, s) from (select cat, sum(amount) as s from e group by cat) t), '{}'::jsonb),
    'items', coalesce((select jsonb_agg(t.x order by t.rn) from (
               select row_number() over (order by spent_on desc, id desc) rn,
                      (to_jsonb(e) - 'staff_id') || jsonb_build_object('mine', e.staff_id = auth.uid()) x
               from e order by spent_on desc, id desc limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) t), '[]'::jsonb)) into r;
  return r;
end $$;
create or replace function public.delete_expense(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_perm('expenses') then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.expenses where id = p_id and (public.is_admin() or staff_id = auth.uid());
  if not found then raise exception 'not authorized' using errcode = '42501'; end if;
end $$;

-- الأرباح والخسائر: sales minus what the sold parts cost, minus expenses, plus/minus stock changes; with sellers and debts
create or replace function public.pnl_report(p_from timestamptz, p_to timestamptz, p_branch uuid default null, p_tz text default 'Africa/Tripoli')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_d0 date; v_d1 date;
begin
  if auth.uid() is null or not public.has_perm('costs') then raise exception 'not authorized' using errcode = '42501'; end if;
  begin v_d0 := (p_from at time zone p_tz)::date; v_d1 := (p_to at time zone p_tz)::date;
  exception when others then v_d0 := p_from::date; v_d1 := p_to::date; end;
  with inv as (select * from public.invoices i where i.status = 'done' and i.created_at >= p_from and i.created_at < p_to and (p_branch is null or i.branch_id = p_branch)),
       items as (select it.* from public.invoice_items it join inv on inv.id = it.invoice_id),
       ci as (select invoice_id, sum(coalesce(cost, 0) * qty) as c from items group by invoice_id),
       ex as (select * from public.expenses e where e.spent_on >= v_d0 and e.spent_on < v_d1 and (p_branch is null or e.branch_id = p_branch)),
       mv as (select * from public.stock_moves m where m.created_at >= p_from and m.created_at < p_to and (p_branch is null or m.branch_id = p_branch)),
       ret as (select * from public.invoices i where i.status = 'returned' and i.returned_at >= p_from and i.returned_at < p_to and (p_branch is null or i.branch_id = p_branch)),
       cb as (select g.due - coalesce(p.paid, 0) as bal
              from (select public.cust_key(customer_name, customer_phone) k, sum(greatest(total - paid, 0)) as due from public.invoices where status = 'done' group by 1) g
              left join (select cust_key k, sum(amount) as paid from public.customer_payments group by 1) p on p.k = g.k where g.k is not null),
       sb as (select g.due - coalesce(p.paid, 0) as bal
              from (select public.sup_key(supplier) k, sum(total - coalesce(paid, total)) as due from public.purchases group by 1) g
              left join (select public.sup_key(supplier) k, sum(amount) as paid from public.supplier_payments group by 1) p on p.k = g.k where g.k is not null)
  select jsonb_build_object(
    'count', (select count(*) from inv),
    'sales', coalesce((select sum(total) from inv), 0),
    'discount', coalesce((select sum(discount) from inv), 0),
    'cogs', coalesce((select sum(c) from ci), 0),
    'cost_missing', (select count(*) from items where cost is null),
    'expenses', coalesce((select sum(amount) from ex), 0),
    'by_cat', coalesce((select jsonb_object_agg(cat, s) from (select cat, sum(amount) as s from ex group by cat) t), '{}'::jsonb),
    'stock_adj', coalesce((select sum(qty * coalesce(cost, 0)) from mv), 0),
    'stock_by_reason', coalesce((select jsonb_object_agg(reason, s) from (select reason, sum(qty * coalesce(cost, 0)) as s from mv group by reason) t), '{}'::jsonb),
    'returned_count', (select count(*) from ret), 'returned_total', coalesce((select sum(total) from ret), 0),
    'by_staff', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', n, 'total', s, 'profit', s - c) order by s desc, name)
                 from (select coalesce(nullif(inv.staff_name, ''), '—') as name, count(*) as n, sum(inv.total) as s, sum(coalesce(ci.c, 0)) as c
                       from inv left join ci on ci.invoice_id = inv.id group by 1) t), '[]'::jsonb),
    'receivable', coalesce((select sum(bal) from cb where bal > 0), 0),
    'payable', coalesce((select sum(bal) from sb where bal > 0), 0)
  ) into r;
  return r || jsonb_build_object('gross', (r->>'sales')::numeric - (r->>'cogs')::numeric,
                                 'net', (r->>'sales')::numeric - (r->>'cogs')::numeric - (r->>'expenses')::numeric + (r->>'stock_adj')::numeric);
end $$;

grant execute on function public.cust_key(text, text) to authenticated;
grant execute on function public.sup_key(text) to authenticated;
grant execute on function public.stock_report(text, text, integer, integer) to authenticated;
grant execute on function public.adjust_stock(jsonb) to authenticated;
grant execute on function public.list_buyers(text, boolean, integer, integer) to authenticated;
grant execute on function public.buyer_detail(text) to authenticated;
grant execute on function public.add_customer_payment(text, numeric, text) to authenticated;
grant execute on function public.delete_customer_payment(bigint) to authenticated;
grant execute on function public.list_suppliers(text, boolean, integer, integer) to authenticated;
grant execute on function public.supplier_detail(text) to authenticated;
grant execute on function public.add_supplier_payment(text, numeric, text) to authenticated;
grant execute on function public.delete_supplier_payment(bigint) to authenticated;
grant execute on function public.add_expense(jsonb) to authenticated;
grant execute on function public.list_expenses(date, date, integer, integer) to authenticated;
grant execute on function public.delete_expense(bigint) to authenticated;
grant execute on function public.pnl_report(timestamptz, timestamptz, uuid, text) to authenticated;
grant select on public.stock_moves, public.customer_payments, public.supplier_payments, public.expenses to authenticated;

-- ---------- 12) تحكم المالك: سجل كل حركة، تغيير الأسعار بالجملة، إلغاء استلام، حدود الموظفين ----------
-- The activity log: who did what, and when. Only the owner reads it, and nobody can change or delete it from the app.
create table if not exists public.activity_log (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_name  text not null default '',
  kind        text not null,
  ref         text not null default '',
  title       text not null default '',
  amount      numeric(14,2),
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc, id desc);
create index if not exists activity_log_actor_idx on public.activity_log (actor_id, created_at desc);
alter table public.activity_log enable row level security;
drop policy if exists "sparat activity read" on public.activity_log;
create policy "sparat activity read" on public.activity_log for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;

-- writes one line; the app cannot call it, only the functions and triggers below
create or replace function public.log_act(p_kind text, p_ref text, p_title text, p_amount numeric default null, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.activity_log (actor_id, actor_name, kind, ref, title, amount, detail)
  values (auth.uid(), coalesce(public.me_name(), ''), p_kind, left(coalesce(p_ref, ''), 80), left(coalesce(p_title, ''), 200), p_amount, coalesce(p_detail, '{}'::jsonb));
$$;
revoke execute on function public.log_act(text, text, text, numeric, jsonb) from public, anon, authenticated;

-- parts edited by hand (the sales, receipts, stock counts, price changes and syncs above write their own line, and say so with sparat.ctx)
create or replace function public.products_log() returns trigger language plpgsql security definer set search_path = public as $$
declare v_d jsonb := '{}'::jsonb;
begin
  if coalesce(current_setting('sparat.ctx', true), '') <> '' then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_act('product_add', new.id::text, new.title, new.price, jsonb_strip_nulls(jsonb_build_object('qty', new.qty, 'cost', new.cost, 'code', coalesce(new.sku, nullif(new.part_no, '')))));
  elsif tg_op = 'DELETE' then
    perform public.log_act('product_del', old.id::text, old.title, old.price, jsonb_strip_nulls(jsonb_build_object('qty', old.qty, 'code', coalesce(old.sku, nullif(old.part_no, '')))));
  else
    if new.price is distinct from old.price then v_d := v_d || jsonb_build_object('price', jsonb_build_array(old.price, new.price)); end if;
    if new.cost is distinct from old.cost then v_d := v_d || jsonb_build_object('cost', jsonb_build_array(old.cost, new.cost)); end if;
    if new.qty is distinct from old.qty then v_d := v_d || jsonb_build_object('qty', jsonb_build_array(old.qty, new.qty)); end if;
    if new.title is distinct from old.title then v_d := v_d || jsonb_build_object('title', jsonb_build_array(old.title, new.title)); end if;
    if new.hide_price is distinct from old.hide_price then v_d := v_d || jsonb_build_object('hide_price', jsonb_build_array(old.hide_price, new.hide_price)); end if;
    if new.status is distinct from old.status and new.qty is not distinct from old.qty then v_d := v_d || jsonb_build_object('status', jsonb_build_array(old.status, new.status)); end if;
    if v_d <> '{}'::jsonb then perform public.log_act('product_edit', new.id::text, new.title, null, v_d); end if;
  end if;
  return null;
end $$;
drop trigger if exists products_log on public.products;
create trigger products_log after insert or update or delete on public.products for each row execute function public.products_log();

-- settings: which ones changed, and from what to what (long texts and lists only by name)
create or replace function public.settings_log() returns trigger language plpgsql security definer set search_path = public as $$
declare v_keys text[]; v_ch jsonb;
begin
  select array_agg(n.key order by n.key), jsonb_object_agg(n.key, case when n.key in ('about', 'bot_rules', 'bot_welcome', 'logo', 'brands', 'brand_logos', 'hero_sub', 'ads', 'ai_rules') then null else jsonb_build_array(o.value, n.value) end)
  into v_keys, v_ch
  from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value and n.key <> 'updated_at';
  if v_keys is not null then perform public.log_act('settings', '', array_to_string(v_keys, ','), null, jsonb_build_object('keys', to_jsonb(v_keys), 'changes', jsonb_strip_nulls(v_ch))); end if;
  return null;
end $$;
drop trigger if exists settings_log on public.settings;
create trigger settings_log after update on public.settings for each row execute function public.settings_log();

-- staff: added, changed (not the account link made when they sign up) or removed
create or replace function public.staff_log() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then return null; end if;
  j := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  perform public.log_act(case when tg_op = 'DELETE' then 'staff_del' else 'staff' end, j->>'id', coalesce(nullif(j->>'name', ''), j->>'email'), null,
    jsonb_build_object('email', j->>'email', 'perms', j->'perms', 'active', j->'active', 'max_discount', j->'max_discount', 'new', tg_op = 'INSERT',
                       'ai_on', j->'ai_on', 'ai_perms', j->'ai_perms',
                       'was', case when tg_op = 'UPDATE' then jsonb_build_object('perms', to_jsonb(old.perms), 'active', old.active, 'max_discount', old.max_discount,
                                                                                  'ai_on', old.ai_on, 'ai_perms', to_jsonb(old.ai_perms)) end));
  return null;
end $$;
drop trigger if exists staff_log on public.staff;
create trigger staff_log after insert or update or delete on public.staff for each row execute function public.staff_log();

-- a customer approved or stopped
create or replace function public.customers_log() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approved is distinct from old.approved then
    perform public.log_act('customer', new.user_id::text, coalesce(nullif(new.name, ''), new.phone, ''), null, jsonb_build_object('approved', new.approved, 'phone', new.phone));
  end if;
  return null;
end $$;
drop trigger if exists customers_log on public.customers;
create trigger customers_log after update of approved on public.customers for each row execute function public.customers_log();

-- money: payments from customers, payments to suppliers, expenses (written and deleted)
create or replace function public.money_log() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  perform public.log_act(
    case tg_table_name when 'customer_payments' then 'pay_in' when 'supplier_payments' then 'pay_out' else 'expense' end || case when tg_op = 'DELETE' then '_del' else '' end,
    j->>'id', case tg_table_name when 'customer_payments' then coalesce(nullif(j->>'customer_name', ''), j->>'cust_key') when 'supplier_payments' then j->>'supplier' else j->>'cat' end,
    (j->>'amount')::numeric, jsonb_strip_nulls(jsonb_build_object('note', nullif(j->>'note', ''), 'by', nullif(j->>'staff_name', ''), 'day', j->>'spent_on', 'key', j->>'cust_key')));
  return null;
end $$;
drop trigger if exists money_log on public.customer_payments;
create trigger money_log after insert or delete on public.customer_payments for each row execute function public.money_log();
drop trigger if exists money_log on public.supplier_payments;
create trigger money_log after insert or delete on public.supplier_payments for each row execute function public.money_log();
drop trigger if exists money_log on public.expenses;
create trigger money_log after insert or delete on public.expenses for each row execute function public.money_log();

-- the log, newest first, for the owner: by kind (sales, stock, prices, money, admin), person, dates or a word
create or replace function public.list_activity(p_group text default null, p_actor uuid default null, p_from timestamptz default null, p_to timestamptz default null,
                                                p_q text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  with hit as (
    select a.* from public.activity_log a
    where (p_from is null or a.created_at >= p_from) and (p_to is null or a.created_at < p_to)
      and (p_actor is null or a.actor_id = p_actor)
      and (v_q is null or public.norm_ar(a.title) like '%' || public.norm_ar(v_q) || '%' or a.detail->>'no' = v_q or public.norm_ar(a.actor_name) like '%' || public.norm_ar(v_q) || '%')
      and (p_group is null or case p_group
            when 'sales'  then a.kind in ('sale', 'return', 'order', 'order_ready', 'order_done', 'order_cancelled')
            when 'stock'  then a.kind in ('receive', 'receipt_undo', 'stock', 'product_add', 'product_del', 'sync', 'import')
                               or (a.kind = 'product_edit' and (a.detail ? 'qty' or a.detail ? 'title' or a.detail ? 'status'))
            when 'prices' then a.kind in ('bulk_price', 'bulk_undo') or (a.kind = 'product_edit' and (a.detail ? 'price' or a.detail ? 'cost' or a.detail ? 'hide_price'))
            when 'money'  then a.kind in ('pay_in', 'pay_in_del', 'pay_out', 'pay_out_del', 'expense', 'expense_del')
            when 'admin'  then a.kind in ('staff', 'staff_del', 'settings', 'customer')
            when 'ai'     then a.kind = 'ai'
            else true end))
  select jsonb_build_object(
    'total', (select count(*) from hit),
    'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc)
                       from (select * from hit order by created_at desc, id desc limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb),
    'actors', coalesce((select jsonb_agg(jsonb_build_object('id', actor_id, 'name', name, 'count', n) order by n desc)
                        from (select actor_id, (array_agg(actor_name order by created_at desc))[1] as name, count(*) as n from public.activity_log where actor_id is not null group by actor_id) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- taking a receipt back (a misread invoice photo, the wrong supplier): the parts go out again, the costs and prices it set go back,
-- parts it created that nothing else uses are removed, and the receipt is deleted (the log keeps what it was).
-- Staff can take back their own receipts for a day; the owner any receipt. Not when some of those parts were already sold.
create or replace function public.undo_receipt(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pu public.purchases; v_it record; v_bad text; n_back integer := 0; n_del integer := 0; v_lines jsonb;
begin
  if auth.uid() is null or not public.has_perm('purchases') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_pu from public.purchases where id = p_id for update;
  if v_pu.id is null then raise exception 'receipt not found' using errcode = 'P0001'; end if;
  if not public.is_admin() and (v_pu.staff_id is distinct from auth.uid() or v_pu.created_at < now() - interval '24 hours') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform set_config('sparat.ctx', 'undo', true);
  perform 1 from public.products where id in (select product_id from public.purchase_items where purchase_id = p_id) for update;
  select string_agg(p.title, '، ' order by p.title) into v_bad
  from (select product_id, sum(qty) as n from public.purchase_items where purchase_id = p_id and product_id is not null group by product_id) a
  join public.products p on p.id = a.product_id
  where coalesce(p.qty, 0) < a.n;
  if v_bad is not null then raise exception 'already sold: %', v_bad using errcode = 'P0001'; end if;
  for v_it in select * from public.purchase_items where purchase_id = p_id and product_id is not null order by id desc loop
    update public.products p set qty = p.qty - v_it.qty,
      status = case when p.qty - v_it.qty <= 0 then 'sold' else p.status end,
      cost  = case when v_it.cost is not null and p.cost = v_it.cost then v_it.prev_cost else p.cost end,
      price = case when v_it.set_price is not null and p.price = v_it.set_price then v_it.prev_price else p.price end
    where p.id = v_it.product_id;
    n_back := n_back + 1;
  end loop;
  select jsonb_agg(jsonb_build_array(title, qty, cost) order by id) into v_lines from (select * from public.purchase_items where purchase_id = p_id order by id limit 100) x;
  delete from public.products p using public.purchase_items it
  where it.purchase_id = p_id and it.created and p.id = it.product_id and coalesce(p.qty, 0) = 0
    and not exists (select 1 from public.invoice_items ii where ii.product_id = p.id)
    and not exists (select 1 from public.purchase_items o where o.product_id = p.id and o.purchase_id <> p_id)
    and not exists (select 1 from public.stock_moves m where m.product_id = p.id);
  get diagnostics n_del = row_count;
  perform public.log_act('receipt_undo', p_id::text, nullif(btrim(v_pu.supplier), ''), v_pu.total,
    jsonb_build_object('no', v_pu.no, 'by', v_pu.staff_name, 'at', v_pu.created_at, 'parts', n_back, 'removed', n_del, 'lines', v_lines));
  delete from public.purchases where id = p_id;
  return jsonb_build_object('no', v_pu.no, 'parts', n_back, 'removed', n_del);
end $$;

-- changing many prices at once: by a percent, by an amount, or cost + a margin; for a brand, a category, a branch, a word or everything.
-- Each change remembers the old prices, so the last ones can be put back.
create sequence if not exists public.price_batch_seq;
create table if not exists public.price_changes (
  batch      bigint not null,
  product_id uuid not null references public.products(id) on delete cascade,
  old_price  numeric(12,2),
  new_price  numeric(12,2),
  primary key (batch, product_id)
);
alter table public.price_changes enable row level security;
revoke all on public.price_changes from anon, authenticated;
create or replace function public.bulk_price_rows(p jsonb) returns table (id uuid, title text, old numeric, cost numeric, new numeric)
language sql stable security definer set search_path = public as $$
  with a as (select coalesce(nullif(p->>'mode', ''), 'pct') as m, public.try_num(p->>'value') as v, coalesce(public.try_num(p->>'round'), 0) as rd,
                    nullif(p->>'make', '') as mk, nullif(p->>'cat', '') as ct, nullif(p->>'shop', '')::uuid as sh, nullif(btrim(coalesce(p->>'q', '')), '') as q),
       t as (select x.id, x.title, x.price as old, x.cost, a.rd,
                    case a.m when 'pct' then x.price * (1 + a.v / 100) when 'add' then x.price + a.v else x.cost * (1 + a.v / 100) end as raw
             from public.products x cross join a
             where (a.mk is null or x.make = a.mk) and (a.ct is null or x.cat = a.ct) and (a.sh is null or x.shop_id = a.sh)
               and (a.q is null or public.norm_ar(x.title) like '%' || public.norm_ar(a.q) || '%' or upper(coalesce(x.sku, '')) like upper(a.q) || '%' or upper(x.part_no) like upper(a.q) || '%')
               and case when a.m = 'margin' then x.cost is not null else x.price is not null end)
  -- rounded up to the step (a price of 47.30 with a step of 5 becomes 50), never below zero
  select t.id, t.title, t.old, t.cost, greatest(case when t.rd > 0 then ceil(t.raw / t.rd) * t.rd else round(t.raw, 2) end, 0)::numeric(12,2) from t;
$$;
revoke execute on function public.bulk_price_rows(jsonb) from public, anon, authenticated;
create or replace function public.bulk_price(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_mode text := coalesce(nullif(p->>'mode', ''), 'pct'); v_val numeric := public.try_num(p->>'value'); v_round numeric := coalesce(public.try_num(p->>'round'), 0);
  v_batch bigint; v_n integer; r jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_mode not in ('pct', 'add', 'margin') then raise exception 'bad mode' using errcode = '22023'; end if;
  if v_val is null or (v_mode = 'pct' and (v_val = 0 or v_val <= -100 or v_val > 1000)) or (v_mode = 'add' and (v_val = 0 or abs(v_val) > 1000000))
     or (v_mode = 'margin' and (v_val < 0 or v_val > 1000)) then raise exception 'bad value' using errcode = '22023'; end if;
  if v_round not in (0, 0.25, 0.5, 1, 5, 10) then raise exception 'bad rounding' using errcode = '22023'; end if;
  if coalesce(p->>'dry', '') = 'true' then
    select jsonb_build_object('count', count(*) filter (where w.new is distinct from w.old), 'same', count(*) filter (where w.new is not distinct from w.old),
             'below', count(*) filter (where w.cost is not null and w.new < w.cost and w.new is distinct from w.old),
             'sample', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'old', s.old, 'new', s.new) order by s.title)
                                 from (select * from public.bulk_price_rows(p) z where z.new is distinct from z.old order by z.title limit 6) s), '[]'::jsonb))
    into r from public.bulk_price_rows(p) w;
    return r;
  end if;
  v_batch := nextval('public.price_batch_seq');
  perform set_config('sparat.ctx', 'bulk', true);
  insert into public.price_changes (batch, product_id, old_price, new_price)
  select v_batch, w.id, w.old, w.new from public.bulk_price_rows(p) w where w.new is distinct from w.old;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'nothing to change' using errcode = '22023'; end if;
  update public.products x set price = c.new_price from public.price_changes c where c.batch = v_batch and c.product_id = x.id;
  -- keep the last 20 changes for putting back
  delete from public.price_changes where batch <= v_batch - 20;
  perform public.log_act('bulk_price', v_batch::text, '', null, jsonb_strip_nulls(jsonb_build_object('mode', v_mode, 'value', v_val, 'round', v_round,
    'make', nullif(p->>'make', ''), 'cat', nullif(p->>'cat', ''), 'shop', nullif(p->>'shop', ''), 'q', nullif(btrim(coalesce(p->>'q', '')), ''), 'count', v_n)));
  return jsonb_build_object('batch', v_batch, 'count', v_n);
end $$;
-- puts back the prices of one change (parts whose price was changed again since keep the newer price)
create or replace function public.undo_bulk_price(p_batch bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n integer; v_all integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select count(*) into v_all from public.price_changes where batch = p_batch;
  if v_all = 0 then raise exception 'nothing to undo' using errcode = 'P0001'; end if;
  perform set_config('sparat.ctx', 'bulk', true);
  update public.products x set price = c.old_price from public.price_changes c
  where c.batch = p_batch and c.product_id = x.id and x.price is not distinct from c.new_price;
  get diagnostics v_n = row_count;
  delete from public.price_changes where batch = p_batch;
  perform public.log_act('bulk_undo', p_batch::text, '', null, jsonb_build_object('count', v_n, 'kept', v_all - v_n));
  return jsonb_build_object('count', v_n, 'kept', v_all - v_n);
end $$;
create or replace function public.price_batches() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce((select jsonb_agg(x order by b desc) from (
    select c.batch as b, jsonb_build_object('batch', c.batch, 'count', count(*), 'created_at', max(a.created_at), 'by', max(a.actor_name), 'detail', (array_agg(a.detail))[1]) as x
    from public.price_changes c left join public.activity_log a on a.kind = 'bulk_price' and a.ref = c.batch::text
    group by c.batch order by c.batch desc limit 5) t), '[]'::jsonb) end;
$$;

grant execute on function public.list_activity(text, uuid, timestamptz, timestamptz, text, integer, integer) to authenticated;
grant execute on function public.undo_receipt(uuid) to authenticated;
grant execute on function public.bulk_price(jsonb) to authenticated;
grant execute on function public.undo_bulk_price(bigint) to authenticated;
grant execute on function public.price_batches() to authenticated;

-- ---------- 13) إعلانات أعلى الرئيسية ----------
-- The company's own banners at the top of the home screen (js/ads.js): up to 5, each with a picture (a link to a photo uploaded
-- to the photos bucket, or any https picture), a title, a line, a button text, where a tap goes ("q" search words, "b" a brand,
-- "wa" a WhatsApp message to the company, "url" an https page), where the words sit on the picture ("pos": "" the start side,
-- "end", "top" or "bottom") and an optional last day ("until", YYYY-MM-DD).
-- Everyone reads them with the settings; only whoever may change the settings can change them, and the log names the change.
--   [{"id": "a1", "img": "https://…", "title": "كل قطع الباترول عندنا", "sub": "…", "cta": "تسوّق توا", "go": "q", "to": "باترول", "until": "", "on": true}]
alter table public.settings add column if not exists ads jsonb not null default '[]'::jsonb;
create or replace function public.ads_ok(p jsonb) returns boolean language sql immutable as $$
  select case
    when p is null or jsonb_typeof(p) <> 'array' then false
    when jsonb_array_length(p) > 5 or octet_length(p::text) > 16000 then false
    else not exists (
      select 1 from jsonb_array_elements(p) x
      where jsonb_typeof(x) <> 'object'
         or char_length(coalesce(x->>'id', '')) > 40
         or char_length(coalesce(x->>'title', '')) > 60
         or char_length(coalesce(x->>'sub', '')) > 120
         or char_length(coalesce(x->>'cta', '')) > 24
         or char_length(coalesce(x->>'to', '')) > 300
         or coalesce(x->>'go', '') not in ('', 'q', 'b', 'wa', 'url')
         or coalesce(x->>'pos', '') not in ('', 'end', 'top', 'bottom')
         or (coalesce(x->>'img', '') <> '' and (char_length(x->>'img') > 600 or (x->>'img') !~ '^https://[^\s"''<>]+$'))
         or (x->>'go' = 'url' and coalesce(x->>'to', '') !~ '^https://[^\s"''<>]+$')
         or (coalesce(x->>'until', '') <> '' and (x->>'until') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
         or (x ? 'on' and jsonb_typeof(x->'on') <> 'boolean'))
  end;
$$;
do $$ begin
  alter table public.settings add constraint settings_ads_chk check (public.ads_ok(ads));
exception when duplicate_object then null; end $$;

-- ---------- 14) المساعد الذكي (AI) ----------
-- The assistant inside the app (js/ai.js, js/ai-tools.js). It belongs to the manager: he always has it with everything; he gives
-- it to an employee (staff.ai_on) with the things it may do for them (staff.ai_perms, kept within their own permissions), and to
-- signed-in customers if he wants (settings.ai_customers: finding parts, questions, the cart). Whatever it changes, it changes
-- through the same functions as the screens, with the person's own permissions, after they tap to confirm, and ai_log writes a line.
-- The server function supabase/functions/assistant asks ai_gate before every call to Claude: who may, and how much a day.
alter table public.settings add column if not exists ai_customers boolean not null default false;
alter table public.settings add column if not exists ai_name text not null default '' check (char_length(ai_name) <= 40);
alter table public.settings add column if not exists ai_rules text not null default '' check (char_length(ai_rules) <= 3000);
alter table public.settings add column if not exists ai_daily integer not null default 40 check (ai_daily between 5 and 1000);

-- one line per message to the assistant (a message can take several calls to Claude: looking things up, preparing)
create table if not exists public.ai_turns (
  user_id    uuid not null references auth.users(id) on delete cascade,
  turn       uuid not null,
  day        date not null,
  calls      integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, turn)
);
create index if not exists ai_turns_day_idx on public.ai_turns (day, user_id);
alter table public.ai_turns enable row level security;   -- no policies: only the functions below read and write it
revoke all on public.ai_turns from anon, authenticated;

-- who may use the assistant now, and what it may do for them
create or replace function public.ai_access() returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then jsonb_build_object('ok', false, 'role', 'visitor')
    when public.is_admin() then jsonb_build_object('ok', true, 'role', 'admin',
      'perms', to_jsonb(array['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'purchases', 'customers', 'reports', 'costs', 'expenses', 'settings']))
    when exists (select 1 from public.staff where user_id = auth.uid() and active) then
      coalesce((select jsonb_build_object('ok', true, 'role', 'staff', 'perms', to_jsonb(array(select x from unnest(ai_perms) x where x = any (perms))))
                from public.staff where user_id = auth.uid() and active and ai_on), jsonb_build_object('ok', false, 'role', 'staff'))
    when coalesce((select ai_customers from public.settings where id = 1), false) then jsonb_build_object('ok', true, 'role', 'customer', 'perms', '[]'::jsonb)
    else jsonb_build_object('ok', false, 'role', 'customer') end;
$$;

-- before every call to Claude: refuses who may not, counts a new message against the day's limit (the manager has none),
-- caps the calls of one message, and gives the server what it tells the assistant (who this is, the manager's instructions)
create or replace function public.ai_gate(p_turn uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare a jsonb := public.ai_access(); v_day date := (now() at time zone 'Africa/Tripoli')::date; v_lim integer; v_used integer; v_calls integer; st public.settings;
begin
  if not coalesce((a->>'ok')::boolean, false) then raise exception 'ai not allowed' using errcode = '42501'; end if;
  if p_turn is null then raise exception 'bad turn' using errcode = '22023'; end if;
  select * into st from public.settings where id = 1;
  v_lim := case when a->>'role' = 'admin' then null else coalesce(st.ai_daily, 40) end;
  if not exists (select 1 from public.ai_turns where user_id = auth.uid() and turn = p_turn) then
    select count(*) into v_used from public.ai_turns where user_id = auth.uid() and day = v_day;
    if v_lim is not null and v_used >= v_lim then raise exception 'ai daily limit' using errcode = 'P0001'; end if;
  end if;
  insert into public.ai_turns as t (user_id, turn, day, calls) values (auth.uid(), p_turn, v_day, 1)
  on conflict (user_id, turn) do update set calls = t.calls + 1 returning calls into v_calls;
  if v_calls > 12 then raise exception 'ai too many steps' using errcode = 'P0001'; end if;
  select count(*) into v_used from public.ai_turns where user_id = auth.uid() and day = v_day;
  return a || jsonb_build_object(
    'left', case when v_lim is null then null else greatest(v_lim - v_used, 0) end,
    'me', coalesce(nullif(public.me_name(), ''), (select name from public.customers where user_id = auth.uid()), ''),
    'branch', (select s.name from public.staff f join public.shops s on s.id = f.branch_id where f.user_id = auth.uid() and f.active),
    'name', st.ai_name, 'rules', st.ai_rules, 'bot_rules', st.bot_rules, 'company', st.brand_name, 'about', left(coalesce(st.about, ''), 1500),
    'contact', st.contact_wa, 'address', st.address, 'price_mode', st.price_mode, 'orders', st.orders_enabled and not coalesce(st.shop_closed, false));
end $$;

-- a line in the activity log for what the assistant did for someone (after they confirmed): what, the tool, and what they asked
create or replace function public.ai_log(p_what text, p_tool text default '', p_ask text default '', p_ref text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((public.ai_access()->>'ok')::boolean, false) or (public.ai_access()->>'role') = 'customer' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform public.log_act('ai', p_ref, p_what, null,
    jsonb_strip_nulls(jsonb_build_object('tool', nullif(left(coalesce(p_tool, ''), 40), ''), 'ask', nullif(left(coalesce(p_ask, ''), 300), ''))));
end $$;

-- the manager's view: messages to the assistant per person over the last days
create or replace function public.ai_usage(p_days integer default 1) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.u, 'name', x.name, 'messages', x.n, 'calls', x.c) order by x.n desc, x.name) from (
    select t.user_id u, count(*) n, sum(t.calls) c,
           coalesce((select nullif(f.name, '') from public.staff f where f.user_id = t.user_id), (select c2.name from public.customers c2 where c2.user_id = t.user_id),
                    (select email from auth.users where id = t.user_id), '') as name
    from public.ai_turns t where t.day > (now() at time zone 'Africa/Tripoli')::date - least(greatest(coalesce(p_days, 1), 1), 90)
    group by t.user_id) x), '[]'::jsonb);
end $$;

grant execute on function public.ai_access() to authenticated;
grant execute on function public.ai_gate(uuid) to authenticated;
grant execute on function public.ai_log(text, text, text, text) to authenticated;
grant execute on function public.ai_usage(integer) to authenticated;

-- ---------- 15) طلبات الزبائن من التطبيق ----------
-- The customer orders in the app itself (not on WhatsApp). The order is an invoice in the sales system with the status
-- «قيد التجهيز» (preparing), then «قيد الاستلام» (ready: waiting for the customer to receive it), then «تم الاستلام»
-- (done: from then on a sale like any other, in the reports and the customer's account, dated the day it was received),
-- or «ملغي» (cancelled: the parts go back to stock). The parts are taken from stock when ordered, so two customers cannot
-- order the last piece; the prices come from the database, never from the phone.
-- (the columns for orders are with the invoices table above)

-- may this person see the prices (the same rule as the parts list)
create or replace function public.prices_shown() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or coalesce((select case price_mode when 'all' then true when 'members' then auth.uid() is not null
                                                              when 'approved' then public.customer_approved() else false end
                                        from public.settings where id = 1), true);
$$;

-- one order, as its customer (or whoever handles orders) sees it
create or replace function public.my_order(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'no', o.no, 'status', o.status, 'source', o.source, 'ordered_at', o.ordered_at, 'ready_at', o.ready_at,
           'done_at', case when o.status in ('done', 'returned') then o.created_at end, 'cancelled_at', o.cancelled_at, 'cancel_reason', o.cancel_reason,
           'delivery', o.delivery, 'address', o.address, 'note', o.note, 'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
           'currency', o.currency, 'payment', case when o.status in ('done', 'returned') then o.payment end, 'sent_at', o.sent_at,
           'total', case when v.ok and not exists (select 1 from public.invoice_items it join public.products p on p.id = it.product_id where it.invoice_id = o.id and p.hide_price)
                         or public.is_staff() then o.total end,
           'branch', (select jsonb_build_object('id', s.id, 'name', s.name, 'city', s.city, 'area', s.area, 'phone', s.phone, 'whatsapp', s.whatsapp) from public.shops s where s.id = o.branch_id),
           'items', coalesce((select jsonb_agg(jsonb_build_object('product_id', it.product_id, 'title', it.title, 'sku', it.sku, 'qty', it.qty,
                       'price', case when public.is_staff() or (v.ok and not coalesce(p.hide_price, false)) then it.price end,
                       'line_total', case when public.is_staff() or (v.ok and not coalesce(p.hide_price, false)) then it.line_total end) order by it.id)
                     from public.invoice_items it left join public.products p on p.id = it.product_id where it.invoice_id = o.id), '[]'::jsonb))
  from public.invoices o cross join lateral (select public.prices_shown() as ok) v
  where o.id = p_id and o.source = 'app' and auth.uid() is not null
    and (o.customer_id = auth.uid() or public.has_perm('sales') or public.has_perm('invoices'));
$$;

-- the customer's «اطلب»: the parts in the basket become an order (an invoice «قيد التجهيز»)
create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); st public.settings; v_c public.customers; v_it jsonb; v_p public.products; v_qty integer;
  v_sub numeric := 0; v_lines jsonb := '[]'::jsonb; v_branch uuid; v_cur text; v_id uuid; v_no bigint; v_units integer := 0;
  v_name text; v_phone text; v_del text := coalesce(nullif(p->>'delivery', ''), 'pickup'); v_addr text := btrim(coalesce(p->>'address', ''));
begin
  if v_me is null then raise exception 'sign in to order' using errcode = '42501'; end if;
  select * into st from public.settings where id = 1;
  if not coalesce(st.orders_enabled, false) or coalesce(st.shop_closed, false) then raise exception 'orders are closed' using errcode = 'P0001'; end if;
  select * into v_c from public.customers where user_id = v_me;
  v_name := left(btrim(coalesce(nullif(btrim(p->>'name'), ''), nullif(btrim(v_c.shop_name), ''), v_c.name, '')), 80);
  v_phone := left(regexp_replace(coalesce(nullif(btrim(p->>'phone'), ''), v_c.phone, ''), '[^0-9+]', '', 'g'), 30);
  if char_length(v_name) < 2 then raise exception 'order needs a name' using errcode = '22023'; end if;
  if char_length(v_phone) < 7 then raise exception 'order needs a phone' using errcode = '22023'; end if;
  if v_del not in ('pickup', 'delivery') then raise exception 'bad delivery' using errcode = '22023'; end if;
  if v_del = 'delivery' and char_length(v_addr) < 5 then raise exception 'delivery needs an address' using errcode = '22023'; end if;
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 or jsonb_array_length(p->'items') > 100 then
    raise exception 'order needs 1 to 100 items' using errcode = '22023';
  end if;
  -- at most 5 orders waiting per customer
  if (select count(*) from public.invoices where customer_id = v_me and source = 'app' and status in ('preparing', 'ready')) >= 5 then
    raise exception 'too many open orders' using errcode = 'P0001';
  end if;
  perform set_config('sparat.ctx', 'order', true);
  for v_it in select value from jsonb_array_elements(p->'items') loop
    v_qty := floor(coalesce(public.try_num(v_it->>'qty'), 0))::integer;
    if v_qty < 1 or v_qty > 1000 then raise exception 'bad quantity' using errcode = '22023'; end if;
    select * into v_p from public.products where id = (v_it->>'id')::uuid for update;
    if v_p.id is null or v_p.status <> 'active' then raise exception 'part not available: %', coalesce(v_p.title, '') using errcode = 'P0001'; end if;
    if v_p.price is null then raise exception 'part has no price: %', v_p.title using errcode = 'P0001'; end if;
    if v_p.qty is not null and v_p.qty < v_qty then
      -- the number stays hidden when the owner hides quantities from customers
      if coalesce(st.hide_qty, false) and not public.is_staff() then raise exception 'not enough stock: %', v_p.title using errcode = 'P0001'; end if;
      raise exception 'not enough stock: % (available %)', v_p.title, v_p.qty using errcode = 'P0001';
    end if;
    update public.products set
      qty = case when qty is null then null else qty - v_qty end,
      status = case when qty is not null and qty - v_qty <= 0 then 'sold' else status end
    where id = v_p.id;
    v_sub := v_sub + v_p.price * v_qty; v_units := v_units + v_qty;
    v_lines := v_lines || jsonb_build_object('product_id', v_p.id, 'sku', coalesce(v_p.sku, nullif(v_p.part_no, '')), 'title', v_p.title,
                                             'qty', v_qty, 'price', v_p.price, 'cost', v_p.cost, 'line_total', v_p.price * v_qty);
    v_branch := coalesce(v_branch, v_p.shop_id);
  end loop;
  select currency into v_cur from public.shops where id = v_branch;
  insert into public.invoices (branch_id, staff_id, staff_name, customer_id, customer_name, customer_phone, subtotal, discount, total, paid, payment, currency, note,
                               status, source, ordered_at, delivery, address)
  values (v_branch, null, '', v_me, v_name, v_phone, v_sub, 0, v_sub, 0, 'cash', coalesce(v_cur, 'LYD'), left(btrim(coalesce(p->>'note', '')), 500),
          'preparing', 'app', now(), v_del, case when v_del = 'delivery' then left(v_addr, 300) else '' end)
  returning id, no into v_id, v_no;
  insert into public.invoice_items (invoice_id, product_id, sku, title, qty, price, cost, line_total)
  select v_id, (x->>'product_id')::uuid, x->>'sku', x->>'title', (x->>'qty')::integer, (x->>'price')::numeric, (x->>'cost')::numeric, (x->>'line_total')::numeric
  from jsonb_array_elements(v_lines) x;
  perform public.log_act('order', v_id::text, v_name, v_sub, jsonb_build_object('no', v_no, 'units', v_units, 'lines', jsonb_array_length(v_lines), 'delivery', v_del));
  return public.my_order(v_id);
end $$;

-- the customer's own orders, newest first
create or replace function public.my_orders(p_limit integer default 30) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select public.my_order(i.id) from public.invoices i
  where i.customer_id = auth.uid() and i.source = 'app'
  order by (i.status in ('preparing', 'ready')) desc, coalesce(i.ordered_at, i.created_at) desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- the parts go back to stock (an order cancelled before it was received)
create or replace function public.order_restock(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.products p set qty = p.qty + a.n, status = case when p.qty + a.n > 0 then 'active' else p.status end
  from (select product_id, sum(qty) as n from public.invoice_items where invoice_id = p_id and product_id is not null group by product_id) a
  where p.id = a.product_id and p.qty is not null;
$$;
revoke execute on function public.order_restock(uuid) from public, anon, authenticated;

-- the customer may cancel while it is still being prepared
create or replace function public.cancel_my_order(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.invoices;
begin
  select * into v from public.invoices where id = p_id and source = 'app' and customer_id = auth.uid() for update;
  if v.id is null then raise exception 'order not found' using errcode = 'P0001'; end if;
  if v.status <> 'preparing' then raise exception 'order can no longer be cancelled' using errcode = 'P0001'; end if;
  perform set_config('sparat.ctx', 'order', true);
  perform public.order_restock(p_id);
  update public.invoices set status = 'cancelled', cancelled_at = now(), cancel_reason = 'customer' where id = p_id;
  perform public.log_act('order_cancelled', p_id::text, nullif(btrim(v.customer_name), ''), v.total, jsonb_build_object('no', v.no, 'was', v.status, 'by', 'customer'));
  return public.my_order(p_id);
end $$;

-- the orders for whoever prepares and hands them over: the open ones (preparing, ready) oldest first, or the done / cancelled ones
create or replace function public.list_orders(p_status text default null, p_limit integer default 30, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_br uuid; r jsonb;
begin
  if auth.uid() is null or not (public.has_perm('sales') or public.has_perm('invoices')) then raise exception 'not authorized' using errcode = '42501'; end if;
  select branch_id into v_br from public.staff where user_id = auth.uid() and active and not public.is_admin();
  with o as (select * from public.invoices i where i.source = 'app' and (v_br is null or i.branch_id = v_br)),
       pick as (select * from o where case coalesce(p_status, '') when '' then status in ('preparing', 'ready') when 'all' then true else status = p_status end)
  select jsonb_build_object(
    'counts', jsonb_build_object('preparing', (select count(*) from o where status = 'preparing'), 'ready', (select count(*) from o where status = 'ready')),
    'total', (select count(*) from pick),
    'items', coalesce((select jsonb_agg(x.j order by x.rn) from (
        select row_number() over (order by case when status in ('preparing', 'ready') then 0 else 1 end,
                                           case when status in ('preparing', 'ready') then extract(epoch from ordered_at) else -extract(epoch from coalesce(cancelled_at, created_at)) end, no) rn,
               jsonb_build_object('id', id, 'no', no, 'status', status, 'ordered_at', ordered_at, 'ready_at', ready_at, 'cancelled_at', cancelled_at,
                 'done_at', case when status in ('done', 'returned') then created_at end, 'customer_name', customer_name, 'customer_phone', customer_phone,
                 'delivery', delivery, 'address', address, 'note', note, 'total', total, 'currency', currency, 'payment', payment, 'staff_name', staff_name,
                 'units', (select coalesce(sum(qty), 0) from public.invoice_items where invoice_id = pick.id),
                 'lines', (select count(*) from public.invoice_items where invoice_id = pick.id)) j
        from pick order by 1 limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- «قيد الاستلام» (ready), «تم الاستلام» (done, with how the customer paid) or «ملغي» (cancelled, the parts back in stock)
create or replace function public.order_set(p_id uuid, p_status text, p_payment text default null, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.invoices; v_staff public.staff; v_pay text := coalesce(nullif(p_payment, ''), 'cash'); v_reason text := left(btrim(coalesce(p_reason, '')), 200);
begin
  if auth.uid() is null or not public.has_perm('sales') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v from public.invoices where id = p_id and source = 'app' for update;
  if v.id is null then raise exception 'order not found' using errcode = 'P0001'; end if;
  select * into v_staff from public.staff where user_id = auth.uid() and active;
  if not public.is_admin() and v_staff.branch_id is not null and v.branch_id is distinct from v_staff.branch_id then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_status = 'ready' then
    if v.status <> 'preparing' then raise exception 'bad order status' using errcode = 'P0001'; end if;
    update public.invoices set status = 'ready', ready_at = now() where id = p_id;
  elsif p_status = 'done' then
    if v.status not in ('preparing', 'ready') then raise exception 'bad order status' using errcode = 'P0001'; end if;
    if v_pay not in ('cash', 'card', 'transfer', 'credit') then raise exception 'bad payment' using errcode = '22023'; end if;
    -- from now on a sale like any other, dated the day it was received
    update public.invoices set status = 'done', created_at = now(), ready_at = coalesce(ready_at, now()), payment = v_pay,
           paid = case when v_pay = 'credit' then 0 else total end, staff_id = auth.uid(), staff_name = coalesce(public.me_name(), '')
    where id = p_id;
  elsif p_status = 'cancelled' then
    if v.status not in ('preparing', 'ready') then raise exception 'bad order status' using errcode = 'P0001'; end if;
    perform set_config('sparat.ctx', 'order', true);
    perform public.order_restock(p_id);
    update public.invoices set status = 'cancelled', cancelled_at = now(), cancel_reason = v_reason where id = p_id;
  else
    raise exception 'bad order status' using errcode = '22023';
  end if;
  perform public.log_act('order_' || p_status, p_id::text, nullif(btrim(v.customer_name), ''), v.total,
    jsonb_build_object('no', v.no, 'was', v.status) || case p_status when 'done' then jsonb_build_object('payment', v_pay) when 'cancelled' then jsonb_build_object('reason', v_reason) else '{}'::jsonb end);
  return public.get_invoice(p_id);
end $$;

grant execute on function public.prices_shown() to anon, authenticated;
grant execute on function public.my_order(uuid) to authenticated;
grant execute on function public.place_order(jsonb) to authenticated;
grant execute on function public.my_orders(integer) to authenticated;
grant execute on function public.cancel_my_order(uuid) to authenticated;
grant execute on function public.list_orders(text, integer, integer) to authenticated;
grant execute on function public.order_set(uuid, text, text, text) to authenticated;

-- ---------- 16) التجار: صادر ووارد، وإرسال الفاتورة للتاجر ----------
-- A merchant (تاجر) signs up in the app with the name of his shop and his phone number, and signs in with the phone number or
-- his email. Each merchant has «صادر ووارد», in the app and in the sales system: what came to him (الوارد: the invoices the
-- company sent him and the orders he received) and what he sent (الصادر: his orders and his payments), with what he still
-- owes. Until the company approves his account he sees his own orders and the invoices sent to it; once approved, every sale
-- under his phone number too (the same customer as in «الزبائن») and his payments, so nobody reads a merchant's account by
-- signing up with his number.
-- (customers.shop_name and invoices.sent_at are with their tables above)

-- a merchant's invoices: the ones sent to his account and his received orders, and once approved, every sale under his number
create or replace function public.merchant_invoices(p_user uuid) returns setof public.invoices
language sql stable security definer set search_path = public as $$
  select i.* from public.invoices i
  where i.customer_id = p_user and (i.sent_at is not null or i.status in ('done', 'returned'))
  union
  select i.* from public.invoices i
  join public.customers c on c.user_id = p_user and c.approved and public.cust_key('', c.phone) like 'p:%'
  where i.status in ('done', 'returned') and public.cust_key(i.customer_name, i.customer_phone) = public.cust_key('', c.phone);
$$;
revoke execute on function public.merchant_invoices(uuid) from public, anon, authenticated;

-- one merchant's «صادر ووارد»: his invoices (الوارد), his orders and payments (الصادر), and what he still owes
create or replace function public.merchant_book(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.customers; v_k text; v_bought numeric; v_due numeric; v_paid numeric := 0; v_open integer; v_staff boolean := public.is_staff(); v_prices boolean := public.prices_shown();
begin
  select * into c from public.customers where user_id = p_user;
  if c.user_id is null then return null; end if;
  v_k := public.cust_key('', c.phone);
  select coalesce(sum(total), 0), coalesce(sum(greatest(total - paid, 0)), 0) into v_bought, v_due from public.merchant_invoices(p_user) where status = 'done';
  if c.approved and v_k like 'p:%' then v_paid := coalesce((select sum(amount) from public.customer_payments where cust_key = v_k), 0); end if;
  select count(*) into v_open from public.invoices where customer_id = p_user and source = 'app' and status in ('preparing', 'ready');
  return jsonb_build_object(
    'user_id', c.user_id, 'shop_name', c.shop_name, 'name', c.name, 'phone', c.phone, 'city', c.city, 'approved', c.approved, 'created_at', c.created_at,
    'bought', v_bought, 'paid_later', v_paid, 'open_orders', v_open,
    -- what he still owes, once the account is approved (before that his payments are not shown, so neither is a total)
    'balance', case when c.approved then v_due - v_paid end,
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'no', i.no, 'status', i.status, 'source', i.source, 'created_at', i.created_at,
                     'sent_at', i.sent_at, 'total', i.total, 'paid', i.paid, 'payment', i.payment, 'currency', i.currency,
                     'units', (select coalesce(sum(qty), 0) from public.invoice_items where invoice_id = i.id)) order by coalesce(i.sent_at, i.created_at) desc, i.no desc)
                   from (select * from public.merchant_invoices(p_user) order by coalesce(sent_at, created_at) desc, no desc limit 100) i), '[]'::jsonb),
    -- an order's total follows the price rules of the parts list, as on the order's own page
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'no', o.no, 'status', o.status, 'ordered_at', o.ordered_at, 'currency', o.currency,
                     'total', case when v_staff or (v_prices and not exists (select 1 from public.invoice_items it join public.products p on p.id = it.product_id
                                                                          where it.invoice_id = o.id and p.hide_price)) then o.total end,
                     'units', (select coalesce(sum(qty), 0) from public.invoice_items where invoice_id = o.id)) order by o.ordered_at desc, o.no desc)
                   from (select * from public.invoices where customer_id = p_user and source = 'app' order by ordered_at desc nulls last, no desc limit 100) o), '[]'::jsonb),
    'payments', case when c.approved and v_k like 'p:%' then coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'amount', x.amount, 'note', x.note, 'created_at', x.created_at)
                     order by x.created_at desc, x.id desc)
                   from (select * from public.customer_payments where cust_key = v_k order by created_at desc, id desc limit 100) x), '[]'::jsonb) else '[]'::jsonb end);
end $$;
revoke execute on function public.merchant_book(uuid) from public, anon, authenticated;

-- the merchant's own «صادر ووارد» (null until his account has its shop name and phone)
create or replace function public.my_book() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is not null then public.merchant_book(auth.uid()) end;
$$;

-- one of his invoices, as he sees it
create or replace function public.my_bill(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'no', i.no, 'status', i.status, 'source', i.source, 'created_at', i.created_at, 'sent_at', i.sent_at,
           'customer_name', i.customer_name, 'customer_phone', i.customer_phone, 'subtotal', i.subtotal, 'discount', i.discount, 'total', i.total,
           'paid', i.paid, 'payment', i.payment, 'currency', i.currency, 'note', i.note, 'staff_name', i.staff_name,
           'branch', (select jsonb_build_object('name', s.name, 'city', s.city, 'phone', s.phone) from public.shops s where s.id = i.branch_id),
           'items', coalesce((select jsonb_agg(jsonb_build_object('title', it.title, 'sku', it.sku, 'qty', it.qty, 'price', it.price, 'line_total', it.line_total) order by it.id)
                              from public.invoice_items it where it.invoice_id = i.id), '[]'::jsonb))
  from public.merchant_invoices(auth.uid()) i where i.id = p_id and auth.uid() is not null;
$$;

-- the invoices sent to him lately, for the notice on «صادر ووارد»
create or replace function public.my_inbox() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'no', x.no, 'sent_at', x.sent_at) order by x.sent_at desc), '[]'::jsonb)
  from (select id, no, sent_at from public.invoices
        where customer_id = auth.uid() and sent_at > now() - interval '60 days' and status <> 'cancelled' order by sent_at desc limit 20) x;
$$;

-- «ابعث الفاتورة للتاجر»: the invoice lands in the merchant's account in the app, and he gets a notice. An app order goes to
-- whoever ordered it; an invoice from the till goes to the merchant chosen. Sending again sends the notice again.
create or replace function public.send_invoice(p_id uuid, p_user uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.invoices; c public.customers; v_to uuid;
begin
  if auth.uid() is null or not (public.has_perm('sales') or public.has_perm('invoices')) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v from public.invoices where id = p_id for update;
  -- the invoices this person may open (get_invoice)
  if v.id is null or not (public.has_perm('invoices') or v.staff_id = auth.uid() or (v.source = 'app' and public.has_perm('sales'))) then
    raise exception 'invoice not found' using errcode = 'P0001';
  end if;
  if v.status = 'cancelled' then raise exception 'invoice cancelled' using errcode = 'P0001'; end if;
  if v.customer_id is not null and p_user is not null and p_user <> v.customer_id then raise exception 'invoice belongs to another merchant' using errcode = 'P0001'; end if;
  v_to := coalesce(v.customer_id, p_user);
  if v_to is null then raise exception 'choose the merchant' using errcode = '22023'; end if;
  select * into c from public.customers where user_id = v_to;
  if c.user_id is null then raise exception 'merchant not found' using errcode = 'P0001'; end if;
  update public.invoices set customer_id = v_to, sent_at = now() where id = p_id;
  perform public.log_act('invoice_sent', p_id::text, coalesce(nullif(btrim(c.shop_name), ''), c.name), v.total,
    jsonb_build_object('no', v.no, 'phone', c.phone, 'again', v.sent_at is not null));
  return public.get_invoice(p_id);
end $$;

-- take back an invoice sent by mistake: it leaves the merchant's account (an invoice from the till is no longer his)
create or replace function public.unsend_invoice(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.invoices;
begin
  if auth.uid() is null or not (public.has_perm('sales') or public.has_perm('invoices')) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v from public.invoices where id = p_id for update;
  if v.id is null or not (public.has_perm('invoices') or v.staff_id = auth.uid() or (v.source = 'app' and public.has_perm('sales'))) then
    raise exception 'invoice not found' using errcode = 'P0001';
  end if;
  if v.sent_at is null then raise exception 'invoice not sent' using errcode = 'P0001'; end if;
  update public.invoices set sent_at = null, customer_id = case when source = 'app' then customer_id end where id = p_id;
  perform public.log_act('invoice_unsent', p_id::text, (select coalesce(nullif(btrim(shop_name), ''), name) from public.customers where user_id = v.customer_id), v.total,
    jsonb_build_object('no', v.no));
  return public.get_invoice(p_id);
end $$;

-- the merchant to send an invoice to: by his shop, his name or his phone number (any 3 digits or more of it)
create or replace function public.find_merchants(p_q text default null, p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_d text;
begin
  if auth.uid() is null or not (public.has_perm('sales') or public.has_perm('invoices') or public.has_perm('customers')) then raise exception 'not authorized' using errcode = '42501'; end if;
  v_d := regexp_replace(public.norm_ar(coalesce(v_q, '')), '[^0-9]', '', 'g');
  if char_length(v_d) > 9 then v_d := right(v_d, 9); end if;
  return coalesce((select jsonb_agg(x.j order by x.rn) from (
    select row_number() over (order by c.approved desc, c.created_at desc) rn,
           jsonb_build_object('user_id', c.user_id, 'shop_name', c.shop_name, 'name', c.name, 'phone', c.phone, 'city', c.city, 'approved', c.approved) j
    from public.customers c
    where v_q is null
       or public.norm_ar(c.shop_name || ' ' || c.name) like '%' || public.norm_ar(v_q) || '%'
       or (char_length(v_d) >= 3 and regexp_replace(public.norm_ar(c.phone), '[^0-9]', '', 'g') like '%' || v_d || '%')
    order by c.approved desc, c.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)) x), '[]'::jsonb);
end $$;

-- «التجار» in the sales system: every merchant registered in the app, open orders first, then the ones waiting for approval
create or replace function public.list_merchants(p_q text default null, p_filter text default null, p_limit integer default 30, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_d text; r jsonb;
begin
  if auth.uid() is null or not (public.has_perm('customers') or public.has_perm('invoices') or public.has_perm('reports')) then raise exception 'not authorized' using errcode = '42501'; end if;
  v_d := regexp_replace(public.norm_ar(coalesce(v_q, '')), '[^0-9]', '', 'g');
  if char_length(v_d) > 9 then v_d := right(v_d, 9); end if;
  with c as (select c.*, public.cust_key('', c.phone) as k from public.customers c
             where v_q is null
                or public.norm_ar(c.shop_name || ' ' || c.name) like '%' || public.norm_ar(v_q) || '%'
                or (char_length(v_d) >= 3 and regexp_replace(public.norm_ar(c.phone), '[^0-9]', '', 'g') like '%' || v_d || '%')),
       m as (select c.*,
               (select count(*) from public.invoices i where i.customer_id = c.user_id and i.source = 'app' and i.status in ('preparing', 'ready')) as open_orders,
               (select max(coalesce(i.sent_at, i.ordered_at, i.created_at)) from public.invoices i where i.customer_id = c.user_id) as last_at,
               case when c.approved then (select coalesce(sum(greatest(total - paid, 0)), 0) from public.merchant_invoices(c.user_id) where status = 'done')
                      - case when c.k like 'p:%' then (select coalesce(sum(amount), 0) from public.customer_payments where cust_key = c.k) else 0 end end as balance
             from c),
       pick as (select * from m where case coalesce(p_filter, '') when 'pending' then not approved when 'owing' then coalesce(balance, 0) > 0
                                                                  when 'orders' then open_orders > 0 else true end)
  select jsonb_build_object(
    'counts', jsonb_build_object('all', (select count(*) from m), 'pending', (select count(*) from m where not approved),
                                 'owing', (select count(*) from m where coalesce(balance, 0) > 0), 'orders', (select count(*) from m where open_orders > 0)),
    'total', (select count(*) from pick),
    'items', coalesce((select jsonb_agg(x.j order by x.rn) from (
        select row_number() over (order by open_orders > 0 desc, approved, coalesce(balance, 0) > 0 desc, last_at desc nulls last, created_at desc, user_id) rn,
               jsonb_build_object('user_id', user_id, 'shop_name', shop_name, 'name', name, 'phone', phone, 'city', city, 'approved', approved,
                                  'created_at', created_at, 'open_orders', open_orders, 'balance', balance, 'last_at', last_at) j
        from pick order by 1 limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- one merchant's page in the sales system: the same «صادر ووارد» he sees, and his key in «الزبائن» (for his payments)
create or replace function public.merchant_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (public.has_perm('customers') or public.has_perm('invoices') or public.has_perm('reports')) then raise exception 'not authorized' using errcode = '42501'; end if;
  return public.merchant_book(p_user) || jsonb_build_object('key', public.cust_key('', (select phone from public.customers where user_id = p_user)));
end $$;

-- the owner gives a merchant a new password (a merchant who signed up with his phone number has no email to reset it with)
create or replace function public.set_customer_password(p_user uuid, p_pw text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare c public.customers;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if char_length(coalesce(p_pw, '')) < 6 or char_length(p_pw) > 72 then raise exception 'bad password' using errcode = '22023'; end if;
  select * into c from public.customers where user_id = p_user;
  if c.user_id is null or exists (select 1 from public.admins where user_id = p_user) or exists (select 1 from public.staff where user_id = p_user) then
    raise exception 'merchant not found' using errcode = 'P0001';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_pw, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
  perform public.log_act('customer_password', p_user::text, coalesce(nullif(btrim(c.shop_name), ''), c.name), null, jsonb_build_object('phone', c.phone));
end $$;

grant execute on function public.my_book() to authenticated;
grant execute on function public.my_bill(uuid) to authenticated;
grant execute on function public.my_inbox() to authenticated;
grant execute on function public.send_invoice(uuid, uuid) to authenticated;
grant execute on function public.unsend_invoice(uuid) to authenticated;
grant execute on function public.find_merchants(text, integer) to authenticated;
grant execute on function public.list_merchants(text, text, integer, integer) to authenticated;
grant execute on function public.merchant_detail(uuid) to authenticated;
grant execute on function public.set_customer_password(uuid, text) to authenticated;
