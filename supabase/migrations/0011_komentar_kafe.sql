-- =====================================================================
--  0011 — Komentar di setiap kafe
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run.
--  Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.cafe_comments (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public.cafes(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.cafe_comments(id) on delete cascade,  -- balasan (1 tingkat)
  body        text not null check (char_length(btrim(body)) between 2 and 1000),
  is_hidden   boolean not null default false,                              -- disembunyikan admin
  created_at  timestamptz not null default now()
);
create index if not exists cafe_comments_cafe_idx on public.cafe_comments (cafe_id, created_at);
create index if not exists cafe_comments_user_idx on public.cafe_comments (user_id, created_at desc);
create index if not exists cafe_comments_recent_idx on public.cafe_comments (created_at desc);

alter table public.cafe_comments enable row level security;

drop policy if exists "comments read"         on public.cafe_comments;
drop policy if exists "comments insert own"   on public.cafe_comments;
drop policy if exists "comments delete"       on public.cafe_comments;
drop policy if exists "comments admin update" on public.cafe_comments;

-- Semua orang bisa membaca komentar yang tidak disembunyikan
create policy "comments read" on public.cafe_comments for select
  using (not is_hidden or user_id = (select auth.uid()) or (select public.is_admin()));

-- Pengguna login boleh berkomentar atas namanya sendiri, hanya di kafe yang tayang
create policy "comments insert own" on public.cafe_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not is_hidden
    and exists (select 1 from public.cafes c where c.id = cafe_id and c.is_published)
  );

-- Hapus komentar sendiri; admin bisa menghapus semua
create policy "comments delete" on public.cafe_comments for delete
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Hanya admin yang bisa mengubah (sembunyikan / tampilkan)
create policy "comments admin update" on public.cafe_comments for update
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Daftar komentar publik + nama & foto penulisnya (profil lengkap tetap privat)
create or replace function public.cafe_comments_list(p_cafe_id uuid)
returns table (
  id uuid, parent_id uuid, body text, created_at timestamptz,
  user_id uuid, author_name text, author_avatar text, author_is_admin boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.parent_id, c.body, c.created_at,
         c.user_id, coalesce(nullif(p.name, ''), 'Pengguna'), p.avatar_url, p.role = 'admin'
  from public.cafe_comments c
  join public.profiles p on p.id = c.user_id
  join public.cafes f on f.id = c.cafe_id
  where c.cafe_id = p_cafe_id
    and not c.is_hidden
    and (f.is_published or public.is_admin())
  order by c.created_at;
$$;
grant execute on function public.cafe_comments_list(uuid) to anon, authenticated;
