-- =====================================================================
--  0024: Daftar pendukung (donasi Saweria / Trakteer / dicatat manual admin)
--  Aman dijalankan ulang. Nominal & email tidak pernah ditampilkan ke publik.
-- =====================================================================
create table if not exists public.supporters (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('saweria', 'trakteer', 'manual')),
  external_id text,                          -- id transaksi dari Saweria/Trakteer (mencegah dobel)
  name        text not null,
  message     text,
  amount      integer,                       -- rupiah; hanya untuk admin
  email       text,                          -- hanya untuk admin
  is_hidden   boolean not null default false,
  raw         jsonb,                         -- isi asli webhook, untuk jaga-jaga
  created_at  timestamptz not null default now()
);
create unique index if not exists supporters_external_uq on public.supporters (source, external_id) where external_id is not null;
create index if not exists supporters_created_idx on public.supporters (created_at desc);

alter table public.supporters enable row level security;
drop policy if exists "supporters admin" on public.supporters;
create policy "supporters admin" on public.supporters for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- Untuk halaman /dukung: hanya nama, pesan, dan waktu (tanpa nominal & email)
create or replace function public.supporters_public(p_limit int default 60)
returns table (id uuid, name text, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.message, s.created_at from public.supporters s
  where not s.is_hidden order by s.created_at desc limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.supporters_public(int) to anon, authenticated;
