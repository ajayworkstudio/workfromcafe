-- =====================================================================
--  0018: Laporan kondisi hari ini (keramaian, colokan, kecepatan wifi)
--  Jalankan di Supabase: SQL Editor, paste seluruh file, Run.
--  Aman dijalankan ulang.
--
--  Pengunjung yang sedang di kafe melapor kondisi saat itu. Laporan dianggap "hari ini"
--  selama 3 jam. Satu akun hanya bisa melapor satu kali per kafe dalam 3 jam,
--  dan maksimal 20 laporan per hari.
-- =====================================================================

create table if not exists public.cafe_reports (
  id            uuid primary key default gen_random_uuid(),
  cafe_id       uuid not null references public.cafes(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  crowd         smallint not null check (crowd between 1 and 3),          -- 1 sepi, 2 sedang, 3 ramai
  plugs         smallint check (plugs between 1 and 3),                   -- 1 gampang dapat, 2 harus cari, 3 penuh
  download_mbps numeric(6,1) check (download_mbps >= 0 and download_mbps <= 2000),
  upload_mbps   numeric(6,1) check (upload_mbps >= 0 and upload_mbps <= 2000),
  ping_ms       integer check (ping_ms >= 0 and ping_ms <= 10000),
  note          text check (char_length(note) <= 140),
  distance_m    integer,                                                  -- jarak pelapor ke kafe saat melapor
  created_at    timestamptz not null default now()
);
create index if not exists cafe_reports_cafe_idx on public.cafe_reports (cafe_id, created_at desc);
create index if not exists cafe_reports_user_idx on public.cafe_reports (user_id, created_at desc);
create index if not exists cafe_reports_recent_idx on public.cafe_reports (created_at desc);

alter table public.cafe_reports enable row level security;

drop policy if exists "reports insert own" on public.cafe_reports;
drop policy if exists "reports read own"   on public.cafe_reports;
drop policy if exists "reports delete"     on public.cafe_reports;

-- Tabel tidak dibaca langsung oleh publik (user_id tetap privat); publik memakai fungsi di bawah.
create policy "reports read own" on public.cafe_reports for select
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "reports insert own" on public.cafe_reports for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.cafes c where c.id = cafe_id and c.is_published)
  );

create policy "reports delete" on public.cafe_reports for delete
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Batas laporan, dicek di database supaya tidak bisa dilewati dari luar aplikasi
create or replace function public.cafe_reports_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.cafe_reports
    where user_id = new.user_id and cafe_id = new.cafe_id and created_at > now() - interval '3 hours'
  ) then
    raise exception 'Kamu sudah melapor kafe ini dalam 3 jam terakhir.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.cafe_reports where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Batas laporan hari ini sudah tercapai.' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists cafe_reports_limit on public.cafe_reports;
create trigger cafe_reports_limit before insert on public.cafe_reports
  for each row execute function public.cafe_reports_limit();

-- Laporan terbaru satu kafe + nama & foto pelapor (24 jam terakhir, maksimal 10)
create or replace function public.cafe_reports_recent(p_cafe_id uuid)
returns table (
  id uuid, crowd smallint, plugs smallint, download_mbps numeric, upload_mbps numeric, ping_ms integer,
  note text, created_at timestamptz, user_id uuid, author_name text, author_avatar text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.crowd, r.plugs, r.download_mbps, r.upload_mbps, r.ping_ms, r.note, r.created_at,
         r.user_id, coalesce(nullif(p.name, ''), 'Pengguna'), p.avatar_url
  from public.cafe_reports r
  join public.profiles p on p.id = r.user_id
  join public.cafes f on f.id = r.cafe_id
  where r.cafe_id = p_cafe_id
    and (f.is_published or public.is_admin())
  order by r.created_at desc
  limit 10;
$$;
grant execute on function public.cafe_reports_recent(uuid) to anon, authenticated;

-- Ringkasan kondisi semua kafe dalam 3 jam terakhir, untuk label di daftar kafe:
-- keramaian & colokan dari laporan paling baru, wifi = median unduhan.
create or replace function public.cafe_reports_live()
returns table (cafe_id uuid, crowd smallint, plugs smallint, download_mbps numeric, reports integer, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with recent as (
    select r.* from public.cafe_reports r
    join public.cafes f on f.id = r.cafe_id and f.is_published
    where r.created_at > now() - interval '3 hours'
  )
  select x.cafe_id,
         (select crowd from recent a where a.cafe_id = x.cafe_id order by created_at desc limit 1),
         (select plugs from recent a where a.cafe_id = x.cafe_id and plugs is not null order by created_at desc limit 1),
         (select round(percentile_cont(0.5) within group (order by download_mbps)::numeric, 0)
            from recent a where a.cafe_id = x.cafe_id and download_mbps is not null),
         count(*)::integer,
         max(x.created_at)
  from recent x
  group by x.cafe_id;
$$;
grant execute on function public.cafe_reports_live() to anon, authenticated;
