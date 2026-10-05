-- =====================================================================
--  0012 — Profil author publik, level, dan author of the month
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run.
--  Aman dijalankan ulang. Butuh 0008 & 0009 sudah dijalankan.
-- =====================================================================

-- 1. Username untuk link profil (workfromcafe…/author/<username>)
alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');
create unique index if not exists profiles_username_key on public.profiles (username);

-- Username otomatis untuk author yang sudah punya kafe
update public.profiles p
set username = left(trim(both '-' from regexp_replace(lower(coalesce(nullif(p.name, ''), 'author')), '[^a-z0-9]+', '-', 'g')), 24)
               || '-' || substr(p.id::text, 1, 4)
where p.username is null
  and exists (select 1 from public.cafes c where c.contributor_id = p.id);

-- 2. Kartu author (dipakai di halaman kafe) — sekarang dengan username & jumlah kafe
drop function if exists public.author_card(uuid);
create function public.author_card(p_id uuid)
returns table (name text, avatar_url text, bio text, instagram text, username text, cafe_count int)
language sql stable security definer set search_path = public as $$
  select p.name, p.avatar_url, p.bio, p.instagram, p.username,
         (select count(*)::int from public.cafes c where c.contributor_id = p.id and c.is_published)
  from public.profiles p
  where p.id = p_id
    and exists (select 1 from public.cafes c where c.contributor_id = p_id and c.is_published);
$$;
grant execute on function public.author_card(uuid) to anon, authenticated;

-- 3. Daftar semua author publik (punya minimal 1 kafe tayang)
drop function if exists public.authors_list();
create function public.authors_list()
returns table (
  id uuid, name text, avatar_url text, bio text, instagram text, username text,
  cafe_count int, month_count int, first_at timestamptz, last_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.name, ''), 'Author'), p.avatar_url, p.bio, p.instagram, p.username,
         count(c.id)::int,
         count(c.id) filter (where c.created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')::int,
         min(c.created_at), max(c.created_at)
  from public.profiles p
  join public.cafes c on c.contributor_id = p.id and c.is_published
  group by p.id
  order by count(c.id) desc, max(c.created_at) desc;
$$;
grant execute on function public.authors_list() to anon, authenticated;

-- 4. Pengaturan: author of the month pilihan admin (username; kosong = otomatis)
insert into public.app_settings (key, value) values ('featured_author', '')
on conflict (key) do nothing;
