-- =====================================================================
--  WorkFromCafe — skema database
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Pengaturan aplikasi (batas kafe gratis, dll.)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key   text primary key,
  value text not null
);
insert into public.app_settings (key, value) values ('free_unlock_limit_per_month', '3');

-- ---------------------------------------------------------------------
-- Profil pengguna (1:1 dengan auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Kota (siap multi-provinsi)
-- ---------------------------------------------------------------------
create table public.cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  province   text not null default 'Jawa Tengah',
  lat        double precision not null,
  lng        double precision not null,
  is_active  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Kafe — kolom di sini PUBLIK (cuplikan)
-- ---------------------------------------------------------------------
create table public.cafes (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  city_id        uuid not null references public.cities(id),
  area           text,
  address        text,
  lat            double precision,
  lng            double precision,
  price_range    smallint not null default 2 check (price_range between 1 and 4), -- 1=$ … 4=$$$$
  opening_hours  jsonb not null default '{}'::jsonb, -- {"mon":["08:00","22:00"], ... , "sun":null}
  my_rating      numeric(2,1) check (my_rating between 0 and 5),
  short_review   text,
  is_featured    boolean not null default false,
  is_published   boolean not null default true,
  visited_at     date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index cafes_city_idx on public.cafes(city_id);

-- Konten PREMIUM per kafe (dipisah agar bisa dikunci dengan RLS)
create table public.cafe_details (
  cafe_id      uuid primary key references public.cafes(id) on delete cascade,
  full_review  text,
  tips         text,          -- mis. "datang sebelum jam 10, colokan di lantai 2"
  best_time    text
);

create table public.cafe_photos (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public.cafes(id) on delete cascade,
  url         text not null,
  is_cover    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index cafe_photos_cafe_idx on public.cafe_photos(cafe_id);

-- Menu rekomendasi (PREMIUM)
create table public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public.cafes(id) on delete cascade,
  name        text not null,
  price       int,
  photo_url   text,
  note        text,
  is_must_try boolean not null default false,
  sort_order  int not null default 0
);
create index menu_items_cafe_idx on public.menu_items(cafe_id);

create table public.tags (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  type  text not null check (type in ('vibe', 'facility'))
);

create table public.cafe_tags (
  cafe_id uuid references public.cafes(id) on delete cascade,
  tag_id  uuid references public.tags(id) on delete cascade,
  primary key (cafe_id, tag_id)
);

-- ---------------------------------------------------------------------
-- Interaksi pengguna
-- ---------------------------------------------------------------------
create table public.favorites (
  user_id    uuid references auth.users(id) on delete cascade,
  cafe_id    uuid references public.cafes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);

create table public.user_visits (
  user_id    uuid references auth.users(id) on delete cascade,
  cafe_id    uuid references public.cafes(id) on delete cascade,
  visited_at date not null default current_date,
  primary key (user_id, cafe_id)
);

-- Kafe yang "dibuka" member gratis (kuota per bulan)
create table public.cafe_unlocks (
  user_id     uuid references auth.users(id) on delete cascade,
  cafe_id     uuid references public.cafes(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);

-- ---------------------------------------------------------------------
-- Langganan & pembayaran
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  plan               text not null check (plan in ('monthly', 'yearly')),
  status             text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  start_date         timestamptz not null,
  end_date           timestamptz not null,
  midtrans_order_id  text unique,
  amount             int not null,
  reminder_sent      boolean not null default false,
  created_at         timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions(user_id, end_date desc);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_id    text not null unique,
  plan        text not null check (plan in ('monthly', 'yearly')),
  amount      int not null,
  status      text not null default 'pending', -- pending | paid | failed | expired
  raw_payload jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =====================================================================
--  Fungsi bantu (dipakai RLS)
-- =====================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_premium()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = auth.uid() and status = 'active' and end_date > now()
  );
$$;

create or replace function public.can_view_full(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.is_premium()
      or exists (select 1 from public.cafe_unlocks where user_id = auth.uid() and cafe_id = p_cafe_id);
$$;

-- Sisa kuota kafe gratis bulan ini
create or replace function public.free_unlocks_left()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0,
    (select value::int from public.app_settings where key = 'free_unlock_limit_per_month')
    - (select count(*)::int from public.cafe_unlocks
       where user_id = auth.uid() and unlocked_at >= date_trunc('month', now()))
  );
$$;

-- Buka satu kafe memakai kuota gratis (dicek di server, tidak bisa diakali dari browser)
create or replace function public.unlock_cafe(p_cafe_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'not_logged_in'; end if;
  if public.can_view_full(p_cafe_id) then return 'already'; end if;
  if public.free_unlocks_left() <= 0 then return 'quota_exceeded'; end if;
  insert into public.cafe_unlocks (user_id, cafe_id) values (auth.uid(), p_cafe_id);
  return 'ok';
end $$;

-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.app_settings  enable row level security;
alter table public.profiles      enable row level security;
alter table public.cities        enable row level security;
alter table public.cafes         enable row level security;
alter table public.cafe_details  enable row level security;
alter table public.cafe_photos   enable row level security;
alter table public.menu_items    enable row level security;
alter table public.tags          enable row level security;
alter table public.cafe_tags     enable row level security;
alter table public.favorites     enable row level security;
alter table public.user_visits   enable row level security;
alter table public.cafe_unlocks  enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;

-- Pengaturan: baca publik, ubah admin
create policy "settings read"  on public.app_settings for select using (true);
create policy "settings admin" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- Profil: lihat & ubah milik sendiri; admin lihat semua.
create policy "profile self read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profile self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profile admin all"   on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Konten publik
create policy "cities read"   on public.cities      for select using (true);
create policy "cafes read"    on public.cafes       for select using (is_published or public.is_admin());
create policy "photos read"   on public.cafe_photos for select using (true);
create policy "tags read"     on public.tags        for select using (true);
create policy "cafetags read" on public.cafe_tags   for select using (true);

-- Konten PREMIUM
create policy "details premium read" on public.cafe_details for select using (public.can_view_full(cafe_id));
create policy "menu premium read"    on public.menu_items   for select using (public.can_view_full(cafe_id));

-- Admin kelola semua konten
create policy "cities admin"   on public.cities       for all using (public.is_admin()) with check (public.is_admin());
create policy "cafes admin"    on public.cafes        for all using (public.is_admin()) with check (public.is_admin());
create policy "details admin"  on public.cafe_details for all using (public.is_admin()) with check (public.is_admin());
create policy "photos admin"   on public.cafe_photos  for all using (public.is_admin()) with check (public.is_admin());
create policy "menu admin"     on public.menu_items   for all using (public.is_admin()) with check (public.is_admin());
create policy "tags admin"     on public.tags         for all using (public.is_admin()) with check (public.is_admin());
create policy "cafetags admin" on public.cafe_tags    for all using (public.is_admin()) with check (public.is_admin());

-- Favorit & kunjungan: milik sendiri
create policy "fav own"    on public.favorites   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visits own" on public.user_visits for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Unlock: hanya baca milik sendiri (insert lewat fungsi unlock_cafe)
create policy "unlock read own" on public.cafe_unlocks for select using (user_id = auth.uid() or public.is_admin());

-- Langganan & pembayaran: baca milik sendiri / admin. Tulis HANYA lewat service role (webhook).
create policy "subs read"     on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy "payments read" on public.payments      for select using (user_id = auth.uid() or public.is_admin());

-- =====================================================================
--  Storage: bucket foto kafe (publik baca, admin tulis)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('cafe-photos', 'cafe-photos', true)
on conflict (id) do nothing;

create policy "cafe photos public read" on storage.objects for select
  using (bucket_id = 'cafe-photos');
create policy "cafe photos admin insert" on storage.objects for insert
  with check (bucket_id = 'cafe-photos' and public.is_admin());
create policy "cafe photos admin update" on storage.objects for update
  using (bucket_id = 'cafe-photos' and public.is_admin());
create policy "cafe photos admin delete" on storage.objects for delete
  using (bucket_id = 'cafe-photos' and public.is_admin());

-- Cegah pengguna biasa mengubah role-nya sendiri jadi admin
create or replace function public.protect_role()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Hanya berlaku untuk request dari aplikasi (role 'authenticated'/'anon').
  -- SQL Editor & service role tetap boleh mengubah role.
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'Tidak boleh mengubah role';
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- updated_at otomatis
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger cafes_touch    before update on public.cafes    for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();
