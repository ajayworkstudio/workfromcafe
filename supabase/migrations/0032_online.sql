-- Status online untuk admin: siapa yang sedang membuka WFC Hunters.
-- Browser mengirim sinyal tiap 1 menit selama tab terbuka (lewat /api/online, service role).
-- Pengunjung tanpa login disimpan sebagai hash harian IP + browser (tanpa IP asli), akun login sebagai user_id.
create table if not exists public.presence (
  key        text primary key,                 -- 'u:<user_id>' atau 'v:<hash pengunjung>'
  user_id    uuid references auth.users(id) on delete cascade,
  path       text,
  started_at timestamptz not null default now(), -- awal sesi: direset kalau sempat tidak aktif 10 menit
  last_seen  timestamptz not null default now()
);
create index if not exists presence_last_seen_idx on public.presence (last_seen desc);

-- Tidak ada policy: anon/authenticated tidak bisa membaca atau menulis tabel ini secara langsung
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

-- Dipanggil server (service role) setiap sinyal masuk. p_leave = tab ditutup, langsung dianggap offline.
create or replace function public.presence_ping(p_key text, p_user uuid, p_path text, p_leave boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_leave then
    delete from presence where key = p_key;
    return;
  end if;
  insert into presence (key, user_id, path) values (p_key, p_user, left(p_path, 200))
  on conflict (key) do update set
    user_id    = excluded.user_id,
    path       = excluded.path,
    started_at = case when presence.last_seen < now() - interval '10 minutes' then now() else presence.started_at end,
    last_seen  = now();
  -- Sesekali bersihkan baris lama supaya tabel tetap kecil
  if random() < 0.02 then
    delete from presence where last_seen < now() - interval '1 day';
  end if;
end $$;
revoke execute on function public.presence_ping(text, uuid, text, boolean) from public, anon, authenticated;

-- Untuk dashboard admin: online = sinyal terakhir dalam 2 menit terakhir.
create or replace function public.admin_online()
returns json language sql stable security definer set search_path = public as $$
  select case when not public.is_admin() then null else json_build_object(
    'visitors', (select count(*) from presence where last_seen > now() - interval '2 minutes'),
    'users', coalesce((
      select json_agg(x order by x.last_seen desc) from (
        select pr.id, pr.name, pr.avatar_url, pr.username, pr.role, p.path, p.started_at, p.last_seen
        from presence p join profiles pr on pr.id = p.user_id
        where p.user_id is not null and p.last_seen > now() - interval '2 minutes'
      ) x), '[]'::json)
  ) end
$$;
revoke execute on function public.admin_online() from public, anon;
grant execute on function public.admin_online() to authenticated;
