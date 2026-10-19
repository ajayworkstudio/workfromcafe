-- =====================================================================
--  0019: Versi kecil (thumbnail) foto kafe
--  Jalankan di Supabase: SQL Editor, paste seluruh file, Run.
--  Aman dijalankan ulang.
--
--  Daftar kafe sebelumnya memuat foto ukuran penuh (sampai 1440 px) untuk kartu kecil,
--  jadi halaman Jelajah & beranda lambat. Thumbnail 640 px dibuat otomatis oleh server
--  dan disimpan di folder thumbs/ bucket cafe-photos.
-- =====================================================================

alter table public.cafe_photos add column if not exists thumb_url text;
