-- =====================================================================
--  0015: Pesan dari kotak kontak
--  Jalankan di Supabase: SQL Editor, paste seluruh file, Run.
--  Aman dijalankan ulang.
-- =====================================================================

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null check (topic in ('saran', 'kafe_saya', 'koreksi', 'kerja_sama', 'lainnya')),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 160),
  body        text not null check (char_length(btrim(body)) between 10 and 2000),
  page        text,                        -- halaman asal (mis. /kafe/ahead)
  user_id     uuid references public.profiles(id) on delete set null,
  ip_hash     text,                        -- untuk batas kirim, bukan IP asli
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_recent_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_ip_idx on public.contact_messages (ip_hash, created_at desc);

alter table public.contact_messages enable row level security;

-- Pesan masuk lewat server (service role) setelah divalidasi, jadi tidak ada policy insert publik.
-- Hanya admin yang bisa membaca, menandai, dan menghapus.
drop policy if exists "contact admin read"   on public.contact_messages;
drop policy if exists "contact admin update" on public.contact_messages;
drop policy if exists "contact admin delete" on public.contact_messages;

create policy "contact admin read" on public.contact_messages for select
  using ((select public.is_admin()));
create policy "contact admin update" on public.contact_messages for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "contact admin delete" on public.contact_messages for delete
  using ((select public.is_admin()));
