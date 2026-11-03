-- 0026: statistik pengunjung per kafe, chat owner dengan admin, dan artikel SEO.
-- Jalankan setelah 0025. Aman dijalankan ulang.

-- =====================================================================
-- 1. Kejadian di halaman kafe (tampil + klik tombol keluar)
-- =====================================================================
create table if not exists public.cafe_events (
  id           bigserial primary key,
  cafe_id      uuid not null references public.cafes(id) on delete cascade,
  kind         text not null check (kind in ('view','maps','menu','instagram','share','whatsapp')),
  -- hash harian IP + browser: menghitung pengunjung unik tanpa menyimpan IP
  viewer_hash  text not null,
  source       text not null default 'langsung' check (source in ('wfc','google','sosial','whatsapp','langsung','lain')),
  device       text not null default 'hp' check (device in ('hp','desktop')),
  visitor_city text,
  logged_in    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists cafe_events_cafe_time_idx on public.cafe_events (cafe_id, created_at desc);
create index if not exists cafe_events_time_idx on public.cafe_events (created_at desc);
alter table public.cafe_events enable row level security;
-- Tidak ada policy: baris hanya ditulis lewat log_cafe_event dan dibaca lewat fungsi statistik di bawah.

-- Catat satu kejadian. Tampilan dari pengunjung yang sama dalam 30 menit dihitung sekali.
-- Admin dan pemilik kafe itu sendiri tidak dihitung, supaya angka yang ditunjukkan ke owner jujur.
drop function if exists public.log_cafe_event(uuid,text,text,text,text,text,boolean);
create or replace function public.log_cafe_event(
  p_cafe_id uuid, p_kind text, p_viewer text, p_source text, p_device text, p_city text, p_user_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.cafes where id = p_cafe_id and is_published) then return; end if;
  if p_user_id is not null and (
    exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
    or exists (select 1 from public.cafe_owners where cafe_id = p_cafe_id and user_id = p_user_id)
  ) then return; end if;
  if exists (
    select 1 from public.cafe_events
    where cafe_id = p_cafe_id and kind = p_kind and viewer_hash = p_viewer
      and created_at > now() - interval '30 minutes'
  ) then return; end if;
  insert into public.cafe_events (cafe_id, kind, viewer_hash, source, device, visitor_city, logged_in)
  values (p_cafe_id, p_kind, left(p_viewer, 64),
          case when p_source in ('wfc','google','sosial','whatsapp','langsung','lain') then p_source else 'lain' end,
          case when p_device = 'desktop' then 'desktop' else 'hp' end,
          nullif(left(p_city, 60), ''), p_user_id is not null);
end;
$$;
revoke all on function public.log_cafe_event(uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.log_cafe_event(uuid,text,text,text,text,text,uuid) to service_role;

-- Statistik satu kafe untuk p_days hari terakhir (WIB), plus periode sebelumnya sebagai pembanding.
-- Boleh dibaca admin dan owner terverifikasi kafe itu.
create or replace function public.cafe_stats(p_cafe_id uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  t0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Jakarta') - make_interval(days => d - 1)) at time zone 'Asia/Jakarta';
  tp timestamptz := t0 - make_interval(days => d);
  out jsonb;
begin
  if not (public.is_admin() or public.is_cafe_owner(p_cafe_id)) then raise exception 'tidak berhak'; end if;
  with e as (select * from public.cafe_events where cafe_id = p_cafe_id and created_at >= tp),
  cur as (select * from e where created_at >= t0),
  prev as (select * from e where created_at < t0)
  select jsonb_build_object(
    'days', d,
    'views', (select count(*) from cur where kind = 'view'),
    'visitors', (select count(distinct viewer_hash) from cur where kind = 'view'),
    'prev_views', (select count(*) from prev where kind = 'view'),
    'prev_visitors', (select count(distinct viewer_hash) from prev where kind = 'view'),
    'actions', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from cur where kind <> 'view' group by kind) a),
    'prev_actions', (select count(*) from prev where kind <> 'view'),
    'sources', (select coalesce(jsonb_object_agg(source, n), '{}') from (select source, count(*) n from cur where kind = 'view' group by source) s),
    'devices', (select coalesce(jsonb_object_agg(device, n), '{}') from (select device, count(*) n from cur where kind = 'view' group by device) v),
    'logged_in', (select count(*) from cur where kind = 'view' and logged_in),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('city', visitor_city, 'n', n) order by n desc), '[]')
               from (select visitor_city, count(*) n from cur where kind = 'view' and visitor_city is not null
                     group by visitor_city order by n desc limit 6) c),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', day, 'views', coalesce(x.views, 0), 'visitors', coalesce(x.visitors, 0)) order by day), '[]')
              from generate_series((t0 at time zone 'Asia/Jakarta')::date, (now() at time zone 'Asia/Jakarta')::date, interval '1 day') g(day)
              left join (select (created_at at time zone 'Asia/Jakarta')::date dd, count(*) views, count(distinct viewer_hash) visitors
                         from cur where kind = 'view' group by 1) x on x.dd = g.day::date),
    'favorites', (select count(*) from public.favorites where cafe_id = p_cafe_id),
    'hours', (select coalesce(jsonb_object_agg(h, n), '{}') from (
               select extract(hour from created_at at time zone 'Asia/Jakarta')::int h, count(*) n
               from cur where kind = 'view' group by 1) hh)
  ) into out;
  return out;
end;
$$;
revoke all on function public.cafe_stats(uuid,int) from public, anon;
grant execute on function public.cafe_stats(uuid,int) to authenticated;

-- Ringkasan semua kafe untuk admin (urut dari yang paling banyak dilihat).
create or replace function public.cafes_stats_overview(p_days int default 30)
returns table (cafe_id uuid, name text, slug text, city text, views bigint, visitors bigint, actions bigint,
               prev_views bigint, favorites bigint, has_owner boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  t0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Jakarta') - make_interval(days => d - 1)) at time zone 'Asia/Jakarta';
  tp timestamptz := t0 - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'khusus admin'; end if;
  return query
  select c.id, c.name, c.slug, ci.name,
    count(*) filter (where e.kind = 'view' and e.created_at >= t0),
    count(distinct e.viewer_hash) filter (where e.kind = 'view' and e.created_at >= t0),
    count(*) filter (where e.kind <> 'view' and e.created_at >= t0),
    count(*) filter (where e.kind = 'view' and e.created_at < t0),
    (select count(*) from public.favorites f where f.cafe_id = c.id),
    exists (select 1 from public.cafe_owners o where o.cafe_id = c.id and o.verified_at is not null)
  from public.cafes c
  left join public.cities ci on ci.id = c.city_id
  left join public.cafe_events e on e.cafe_id = c.id and e.created_at >= tp
  where c.is_published
  group by c.id, c.name, c.slug, ci.name
  order by 5 desc, c.name;
end;
$$;
revoke all on function public.cafes_stats_overview(int) from public, anon;
grant execute on function public.cafes_stats_overview(int) to authenticated;

-- Jangkauan seluruh platform (angka publik untuk halaman Untuk pemilik kafe).
create or replace function public.platform_reach(p_days int default 30)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'views', count(*) filter (where kind = 'view'),
    'visitors', count(distinct viewer_hash) filter (where kind = 'view'),
    'actions', count(*) filter (where kind <> 'view'),
    'cafes', (select count(*) from public.cafes where is_published),
    'cities', (select count(distinct city_id) from public.cafes where is_published)
  )
  from public.cafe_events
  where created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
$$;
grant execute on function public.platform_reach(int) to anon, authenticated;

-- =====================================================================
-- 2. Chat owner kafe dengan admin (satu percakapan per kafe)
-- =====================================================================
create table if not exists public.owner_messages (
  id         bigserial primary key,
  cafe_id    uuid not null references public.cafes(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  from_admin boolean not null default false,
  body       text not null check (char_length(body) between 1 and 2000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists owner_messages_cafe_idx on public.owner_messages (cafe_id, created_at);
alter table public.owner_messages enable row level security;

-- Pemilik yang sudah mengajukan klaim (belum diverifikasi pun) boleh chat, supaya bukti kepemilikan bisa dikirim di sini.
create or replace function public.is_cafe_claimant(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.cafe_owners where cafe_id = p_cafe_id and user_id = auth.uid()); $$;
revoke all on function public.is_cafe_claimant(uuid) from public, anon;
grant execute on function public.is_cafe_claimant(uuid) to authenticated;

drop policy if exists "owner_msg_read" on public.owner_messages;
create policy "owner_msg_read" on public.owner_messages for select
  using (public.is_admin() or public.is_cafe_claimant(cafe_id));
drop policy if exists "owner_msg_send_owner" on public.owner_messages;
create policy "owner_msg_send_owner" on public.owner_messages for insert
  with check (sender_id = auth.uid() and not from_admin and read_at is null and public.is_cafe_claimant(cafe_id));
drop policy if exists "owner_msg_send_admin" on public.owner_messages;
create policy "owner_msg_send_admin" on public.owner_messages for insert
  with check (sender_id = auth.uid() and from_admin and read_at is null and public.is_admin());
drop policy if exists "owner_msg_admin_delete" on public.owner_messages;
create policy "owner_msg_admin_delete" on public.owner_messages for delete using (public.is_admin());

-- Tandai pesan dari pihak lain sebagai sudah dibaca.
create or replace function public.owner_messages_mark_read(p_cafe_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if public.is_admin() then
    update public.owner_messages set read_at = now() where cafe_id = p_cafe_id and not from_admin and read_at is null;
  elsif public.is_cafe_claimant(p_cafe_id) then
    update public.owner_messages set read_at = now() where cafe_id = p_cafe_id and from_admin and read_at is null;
  end if;
end;
$$;
revoke all on function public.owner_messages_mark_read(uuid) from public, anon;
grant execute on function public.owner_messages_mark_read(uuid) to authenticated;

-- Notifikasi pesan owner ikut masuk lonceng
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('new_cafe', 'activity', 'owner_message'));

-- =====================================================================
-- 3. Artikel SEO yang ditulis manual (artikel otomatis dibuat dari data kafe, tanpa tabel)
-- =====================================================================
create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{3,90}$'),
  title        text not null check (char_length(title) between 5 and 120),
  excerpt      text check (char_length(excerpt) <= 300),
  body         text not null default '',
  cover_url    text,
  city_id      uuid references public.cities(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  author_id    uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists articles_pub_idx on public.articles (is_published, published_at desc);
alter table public.articles enable row level security;
drop policy if exists "articles_read" on public.articles;
create policy "articles_read" on public.articles for select using (is_published or public.is_admin());
drop policy if exists "articles_admin" on public.articles;
create policy "articles_admin" on public.articles for all using (public.is_admin()) with check (public.is_admin());
