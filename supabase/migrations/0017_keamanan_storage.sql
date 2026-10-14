-- =====================================================================
--  0017: Batasi file yang boleh diunggah ke bucket cafe-photos
--  Jalankan di Supabase: SQL Editor, paste seluruh file, Run.
--  Aman dijalankan ulang.
--
--  Sebelumnya bucket menerima file jenis dan ukuran apa pun. Pengguna yang login (author)
--  bisa mengunggah file HTML/SVG/berukuran besar ke folder miliknya, lalu memakai link
--  publik Supabase untuk menyebarkan halaman palsu atau menghabiskan kuota penyimpanan.
--  Semua foto dari aplikasi dikompres ke WebP di browser (maks ±1 MB), jadi batas ini aman.
-- =====================================================================

update storage.buckets
set file_size_limit = 5 * 1024 * 1024,                                  -- 5 MB
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'] -- tanpa SVG/HTML
where id = 'cafe-photos';
