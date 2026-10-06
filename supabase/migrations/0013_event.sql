-- =====================================================================
--  0013 — Event (sementara hanya admin; umum melihat "Segera")
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run.
--  Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  kind          text not null default 'kerja_bareng',   -- jenis event (lihat src/lib/events.ts)
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  city_id       uuid references public.cities(id) on delete set null,
  cafe_id       uuid references public.cafes(id) on delete set null,
  venue         text,                                   -- nama tempat kalau bukan kafe di database
  description   text,
  cover_url     text,
  register_url  text,                                   -- link daftar (WhatsApp / Google Form)
  quota         int check (quota is null or quota > 0),
  price         text,                                   -- mis. "Gratis" atau "Rp25.000 (sudah termasuk 1 minuman)"
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists events_starts_idx on public.events (starts_at);

alter table public.events enable row level security;

-- Pengaturan: menu Event dibuka untuk umum atau belum
insert into public.app_settings (key, value) values ('events_public', 'false')
on conflict (key) do nothing;

drop policy if exists "events read"  on public.events;
drop policy if exists "events admin" on public.events;

-- Umum hanya bisa membaca event yang tayang, dan hanya kalau menu Event sudah dibuka
create policy "events read" on public.events for select using (
  (select public.is_admin())
  or (is_published and exists (select 1 from public.app_settings s where s.key = 'events_public' and s.value = 'true'))
);
create policy "events admin" on public.events for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
