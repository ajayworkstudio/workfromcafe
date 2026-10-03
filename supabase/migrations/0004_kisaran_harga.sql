-- =====================================================================
--  0004 — Kisaran harga jadi 5 pilihan:
--  1 = 10K–30K, 2 = 20K–40K, 3 = 30K–50K, 4 = 40K–60K, 5 = 60K ke atas
--  Aman dijalankan ulang.
-- =====================================================================
alter table public.cafes drop constraint if exists cafes_price_range_check;
alter table public.cafes add constraint cafes_price_range_check check (price_range between 1 and 5);
