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
    new.search_text := left(public.norm_ar(concat_ws(' ', new.title, new.part_no, new.make, new.model, new.descr)), 3000);
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
language sql stable set search_path = public as $$
  select (to_jsonb(p) - 'search_text') || jsonb_build_object(
           'shop', jsonb_build_object(
             'id', s.id, 'name', s.name, 'city', s.city, 'area', s.area, 'hours', s.hours,
             'whatsapp', s.whatsapp, 'phone', s.phone, 'logo', s.logo,
             'verified', s.verified, 'owner_id', s.owner_id,
             'country', s.country, 'currency', s.currency),
           'total_count', count(*) over ())
  from public.products p
  join public.shops s on s.id = p.shop_id
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
    case when p_sort = 'cheap' then p.price end asc nulls last,
    case when p_sort = 'exp'   then p.price end desc nulls last,
    p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

drop function if exists public.store_stats(text, uuid);
drop function if exists public.store_stats(text, uuid, text);
create function public.store_stats(p_city text default null, p_shop uuid default null, p_country text default null)
returns jsonb language sql stable set search_path = public as $$
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
language sql stable set search_path = public as $$
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
returns setof jsonb language sql stable set search_path = public as $$
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
returns setof jsonb language sql stable set search_path = public as $$
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
