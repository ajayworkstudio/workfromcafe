-- 0028: kolom SEO opsional untuk artikel. Kosong = pakai judul / ringkasan / judul artikel. Aman dijalankan ulang.
alter table public.articles add column if not exists meta_title text check (meta_title is null or char_length(meta_title) <= 70);
alter table public.articles add column if not exists meta_description text check (meta_description is null or char_length(meta_description) <= 170);
alter table public.articles add column if not exists cover_alt text check (cover_alt is null or char_length(cover_alt) <= 160);
