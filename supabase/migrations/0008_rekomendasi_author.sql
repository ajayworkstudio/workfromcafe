-- =====================================================================
--  0008 — Rekomendasi kafe dari author (pengguna yang login)
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run.
--  Aman dijalankan ulang.
-- =====================================================================

-- 1. Kiriman rekomendasi
create table if not exists public.cafe_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  author_name  text not null,
  author_instagram text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  data         jsonb not null,             -- semua isian form (nama, kota, penilaian, fasilitas, menu, foto, …)
  admin_note   text,                       -- alasan ditolak / catatan untuk author
  cafe_id      uuid references public.cafes(id) on delete set null,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create index if not exists cafe_submissions_user_idx   on public.cafe_submissions (user_id, created_at desc);
create index if not exists cafe_submissions_status_idx on public.cafe_submissions (status, created_at desc);

alter table public.cafe_submissions enable row level security;

drop policy if exists "submissions read"         on public.cafe_submissions;
drop policy if exists "submissions insert own"   on public.cafe_submissions;
drop policy if exists "submissions delete own"   on public.cafe_submissions;
drop policy if exists "submissions admin update" on public.cafe_submissions;

create policy "submissions read" on public.cafe_submissions for select
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Author hanya boleh membuat kiriman berstatus pending atas namanya sendiri
create policy "submissions insert own" on public.cafe_submissions for insert
  with check (user_id = (select auth.uid()) and status = 'pending' and cafe_id is null and admin_note is null);
-- Author boleh menarik kiriman yang belum direview
create policy "submissions delete own" on public.cafe_submissions for delete
  using ((user_id = (select auth.uid()) and status = 'pending') or (select public.is_admin()));
create policy "submissions admin update" on public.cafe_submissions for update
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 2. Kredit author di halaman kafe
alter table public.cafes add column if not exists contributor_name      text;
alter table public.cafes add column if not exists contributor_instagram text;
alter table public.cafes add column if not exists contributor_id        uuid references auth.users(id) on delete set null;

-- 3. Author boleh mengunggah foto ke folder submissions/<id-nya>/ di bucket cafe-photos
drop policy if exists "submission photos insert" on storage.objects;
drop policy if exists "submission photos delete" on storage.objects;
create policy "submission photos insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cafe-photos'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy "submission photos delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'cafe-photos'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
