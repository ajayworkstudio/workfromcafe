-- =====================================================================
--  0009 — Profil pengguna: foto, bio, Instagram
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run.
--  Aman dijalankan ulang.
-- =====================================================================

-- 1. Kolom profil baru
alter table public.profiles add column if not exists bio       text;
alter table public.profiles add column if not exists instagram text;
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 300);

-- 2. Kartu author untuk halaman kafe (hanya untuk pengguna yang punya kafe tayang sebagai author)
create or replace function public.author_card(p_id uuid)
returns table (name text, avatar_url text, bio text, instagram text)
language sql stable security definer set search_path = public as $$
  select p.name, p.avatar_url, p.bio, p.instagram
  from public.profiles p
  where p.id = p_id
    and exists (select 1 from public.cafes c where c.contributor_id = p_id and c.is_published);
$$;
grant execute on function public.author_card(uuid) to anon, authenticated;

-- 3. Foto profil disimpan di bucket cafe-photos, folder avatars/<id pengguna>/
drop policy if exists "avatar insert own" on storage.objects;
drop policy if exists "avatar delete own" on storage.objects;
create policy "avatar insert own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cafe-photos'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy "avatar delete own" on storage.objects for delete to authenticated
  using (
    bucket_id = 'cafe-photos'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
