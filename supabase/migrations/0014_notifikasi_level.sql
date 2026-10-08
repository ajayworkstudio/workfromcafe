-- =====================================================================
--  0014 — Penanda email naik level author (supaya tidak terkirim dua kali)
--  Jalankan di Supabase: SQL Editor → paste → Run. Aman dijalankan ulang.
-- =====================================================================
-- 0 = belum pernah dikabari, 1 = Penjelajah, 2 = Kurator, 3 = Kurator Utama
alter table public.profiles add column if not exists notified_level int not null default 0;
