-- =====================================================================
--  0021: Notifikasi (kafe baru & aktivitas di kafe favorit) + push ke perangkat
--  Jalankan di Supabase: SQL Editor, paste seluruh file, Run.
--  Aman dijalankan ulang.
-- =====================================================================

-- 1. Isi notifikasi. user_id kosong = untuk semua pengguna terdaftar (mis. kafe baru).
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('new_cafe', 'activity')),
  title      text not null,
  body       text,
  url        text,
  cafe_id    uuid references public.cafes(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_all_idx  on public.notifications (created_at desc) where user_id is null;
create index if not exists notifications_cafe_idx on public.notifications (cafe_id, kind, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications read" on public.notifications;
-- Baca: notifikasi umum hanya untuk yang sudah login, notifikasi pribadi hanya pemiliknya. Tulis: hanya server (service role).
create policy "notifications read" on public.notifications for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

-- 2. Langganan push per perangkat (browser / aplikasi di layar utama)
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push own read" on public.push_subscriptions;
create policy "push own read" on public.push_subscriptions for select using (user_id = (select auth.uid()));

-- 3. Pilihan notifikasi & kapan terakhir membuka daftar notifikasi
alter table public.profiles add column if not exists notify_new_cafe boolean not null default true;
alter table public.profiles add column if not exists notify_activity boolean not null default true;
alter table public.profiles add column if not exists notif_seen_at  timestamptz not null default now();

-- 4. Penanda kafe yang sudah diumumkan (supaya tidak diumumkan dua kali). Kafe yang sudah tayang dianggap sudah diumumkan.
alter table public.cafes add column if not exists announced_at timestamptz;
update public.cafes set announced_at = coalesce(announced_at, now()) where is_published and announced_at is null;

-- 5. Jumlah notifikasi belum dibaca (untuk titik merah di lonceng)
create or replace function public.notif_unread_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications n
  where (n.user_id is null or n.user_id = auth.uid())
    and n.created_at > coalesce((select notif_seen_at from public.profiles where id = auth.uid()), now());
$$;
grant execute on function public.notif_unread_count() to authenticated;
