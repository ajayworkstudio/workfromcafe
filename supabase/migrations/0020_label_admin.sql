-- =====================================================================
--  0020: Label "Admin" di laporan kondisi, kartu author, dan daftar author
--  Jalankan di Supabase: SQL Editor, paste seluruh file, Run.
--  Aman dijalankan ulang. Isi fungsi sama seperti sebelumnya, hanya ditambah kolom is_admin.
-- =====================================================================

-- 1. Laporan kondisi terbaru per kafe (+ author_is_admin)
drop function if exists public.cafe_reports_recent(uuid);
create function public.cafe_reports_recent(p_cafe_id uuid)
returns table (
  id uuid, crowd smallint, plugs smallint, download_mbps numeric, upload_mbps numeric, ping_ms integer,
  note text, created_at timestamptz, user_id uuid, author_name text, author_avatar text, author_is_admin boolean
)
language sql stable security definer set search_path = public as $$
  select r.id, r.crowd, r.plugs, r.download_mbps, r.upload_mbps, r.ping_ms, r.note, r.created_at,
         r.user_id, coalesce(nullif(p.name, ''), 'Pengguna'), p.avatar_url, p.role = 'admin'
  from public.cafe_reports r
  join public.profiles p on p.id = r.user_id
  join public.cafes f on f.id = r.cafe_id
  where r.cafe_id = p_cafe_id
    and (f.is_published or public.is_admin())
  order by r.created_at desc
  limit 10;
$$;
grant execute on function public.cafe_reports_recent(uuid) to anon, authenticated;

-- 2. Kartu author di halaman kafe (+ is_admin)
drop function if exists public.author_card(uuid);
create function public.author_card(p_id uuid)
returns table (name text, avatar_url text, bio text, instagram text, username text, cafe_count int, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select p.name, p.avatar_url, p.bio, p.instagram, p.username,
         (select count(*)::int from public.cafes c where c.contributor_id = p.id and c.is_published),
         p.role = 'admin'
  from public.profiles p
  where p.id = p_id
    and exists (select 1 from public.cafes c where c.contributor_id = p_id and c.is_published);
$$;
grant execute on function public.author_card(uuid) to anon, authenticated;

-- 3. Daftar author publik (+ is_admin)
drop function if exists public.authors_list();
create function public.authors_list()
returns table (
  id uuid, name text, avatar_url text, bio text, instagram text, username text,
  cafe_count int, month_count int, first_at timestamptz, last_at timestamptz, is_admin boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.name, ''), 'Author'), p.avatar_url, p.bio, p.instagram, p.username,
         count(c.id)::int,
         count(c.id) filter (where c.created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')::int,
         min(c.created_at), max(c.created_at),
         p.role = 'admin'
  from public.profiles p
  join public.cafes c on c.contributor_id = p.id and c.is_published
  group by p.id
  order by count(c.id) desc, max(c.created_at) desc;
$$;
grant execute on function public.authors_list() to anon, authenticated;
