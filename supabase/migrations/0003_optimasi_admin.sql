-- =====================================================================
--  0003 — Optimasi Supabase + pengaturan yang bisa diubah dari panel admin
--  Jalankan SETELAH 0001 dan 0002. Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pengaturan yang bisa diubah admin tanpa coding
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('price_monthly', '25000'),
  ('price_yearly',  '250000')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Indeks untuk query yang sering dipakai
-- ---------------------------------------------------------------------
create index if not exists cafes_published_rating_idx on public.cafes (is_published, my_rating desc);
create index if not exists cafes_featured_idx        on public.cafes (is_featured) where is_featured;
create index if not exists cafes_created_idx         on public.cafes (created_at desc);
create index if not exists cafe_tags_tag_idx         on public.cafe_tags (tag_id);
create index if not exists menu_items_sort_idx       on public.menu_items (cafe_id, sort_order);
create index if not exists cafe_photos_sort_idx      on public.cafe_photos (cafe_id, sort_order);
create index if not exists favorites_user_idx        on public.favorites (user_id, created_at desc);
create index if not exists user_visits_user_idx      on public.user_visits (user_id);
create index if not exists cafe_unlocks_month_idx    on public.cafe_unlocks (user_id, unlocked_at);
create index if not exists payments_user_idx         on public.payments (user_id, created_at desc);
create index if not exists payments_status_idx       on public.payments (status, created_at desc);
create index if not exists subscriptions_active_idx  on public.subscriptions (status, end_date);
create index if not exists profiles_role_idx         on public.profiles (role) where role = 'admin';

-- ---------------------------------------------------------------------
-- 3. RLS lebih cepat: (select fungsi()) dievaluasi sekali per query,
--    bukan sekali per baris (rekomendasi resmi Supabase).
-- ---------------------------------------------------------------------
create or replace function public.can_view_full(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.is_premium()
      or exists (select 1 from public.cafe_unlocks where user_id = auth.uid() and cafe_id = p_cafe_id);
$$;

do $$
declare r record;
begin
  -- hapus semua policy lama di schema public lalu buat ulang di bawah
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Pengaturan
create policy "settings read"  on public.app_settings for select using (true);
create policy "settings admin" on public.app_settings for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Profil
create policy "profile read"   on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profile update" on public.profiles for update
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- Konten publik
create policy "cities read"   on public.cities      for select using (true);
create policy "cafes read"    on public.cafes       for select using (is_published or (select public.is_admin()));
create policy "photos read"   on public.cafe_photos for select using (true);
create policy "tags read"     on public.tags        for select using (true);
create policy "cafetags read" on public.cafe_tags   for select using (true);

-- Konten premium
create policy "details read" on public.cafe_details for select using (
  (select public.is_admin()) or (select public.is_premium())
  or exists (select 1 from public.cafe_unlocks u where u.user_id = (select auth.uid()) and u.cafe_id = cafe_details.cafe_id)
);
create policy "menu read" on public.menu_items for select using (
  (select public.is_admin()) or (select public.is_premium())
  or exists (select 1 from public.cafe_unlocks u where u.user_id = (select auth.uid()) and u.cafe_id = menu_items.cafe_id)
);

-- Admin kelola konten (insert/update/delete; select sudah diatur di atas)
do $$
declare t text;
begin
  foreach t in array array['cities','cafes','cafe_details','cafe_photos','menu_items','tags','cafe_tags'] loop
    execute format('create policy "%s admin insert" on public.%I for insert with check ((select public.is_admin()))', t, t);
    execute format('create policy "%s admin update" on public.%I for update using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);
    execute format('create policy "%s admin delete" on public.%I for delete using ((select public.is_admin()))', t, t);
  end loop;
end $$;

-- Milik pengguna sendiri
create policy "fav own"    on public.favorites   for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "visits own" on public.user_visits for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "unlock read" on public.cafe_unlocks for select using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Langganan & pembayaran: hanya baca. Tulis lewat service role (webhook / panel admin di server).
create policy "subs read"     on public.subscriptions for select using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "payments read" on public.payments      for select using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- 4. Ringkasan dashboard admin dihitung di database (tidak menarik semua baris)
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  return json_build_object(
    'cafes',           (select count(*) from cafes),
    'cafes_draft',     (select count(*) from cafes where not is_published),
    'users',           (select count(*) from profiles),
    'active_subs',     (select count(distinct user_id) from subscriptions where status = 'active' and end_date > now()),
    'revenue_month',   (select coalesce(sum(amount), 0) from payments where status = 'paid' and created_at >= date_trunc('month', now())),
    'revenue_total',   (select coalesce(sum(amount), 0) from payments where status = 'paid'),
    'expiring_7d',     (select count(*) from subscriptions where status = 'active' and end_date between now() and now() + interval '7 days')
  );
end $$;

-- Jumlah kafe per tag & per kota (untuk mencegah hapus yang masih dipakai)
create or replace function public.admin_usage_counts()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'tags',   (select coalesce(json_object_agg(tag_id, n), '{}'::json) from (select tag_id, count(*) n from cafe_tags group by tag_id) x),
    'cities', (select coalesce(json_object_agg(city_id, n), '{}'::json) from (select city_id, count(*) n from cafes group by city_id) y)
  ) else null end;
$$;

-- Supabase membutuhkan grant eksplisit untuk fungsi baru
grant execute on function public.admin_stats(), public.admin_usage_counts() to authenticated;
