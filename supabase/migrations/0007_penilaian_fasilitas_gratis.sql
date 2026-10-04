-- =====================================================================
--  0007 — Penilaian per aspek, fasilitas, dan mode gratis
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run.
--  Aman dijalankan ulang.
-- =====================================================================

-- 1. Penilaian per aspek & fasilitas (publik, disimpan sebagai JSON)
--    scores    : {"internet": 4, "colokan": 3.5, ..., "notes": {"internet": "50 Mbps"}}
--    amenities : {"wifi": true, "parkir": false, "mushola": null, ...}   null = belum dicek
alter table public.cafes add column if not exists scores    jsonb not null default '{}'::jsonb;
alter table public.cafes add column if not exists amenities jsonb not null default '{}'::jsonb;

-- 2. Mode gratis: kalau 'true', semua konten (ulasan lengkap, menu, peta) terbuka untuk semua orang
insert into public.app_settings (key, value) values ('free_mode', 'true')
on conflict (key) do nothing;

create or replace function public.free_mode()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true' from public.app_settings where key = 'free_mode'), false);
$$;
grant execute on function public.free_mode() to anon, authenticated;

create or replace function public.can_view_full(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.free_mode()
      or public.is_admin()
      or public.is_premium()
      or exists (select 1 from public.cafe_unlocks where user_id = auth.uid() and cafe_id = p_cafe_id);
$$;

drop policy if exists "details read" on public.cafe_details;
create policy "details read" on public.cafe_details for select using (
  (select public.free_mode()) or (select public.is_admin()) or (select public.is_premium())
  or exists (select 1 from public.cafe_unlocks u where u.user_id = (select auth.uid()) and u.cafe_id = cafe_details.cafe_id)
);

drop policy if exists "menu read" on public.menu_items;
create policy "menu read" on public.menu_items for select using (
  (select public.free_mode()) or (select public.is_admin()) or (select public.is_premium())
  or exists (select 1 from public.cafe_unlocks u where u.user_id = (select auth.uid()) and u.cafe_id = menu_items.cafe_id)
);
