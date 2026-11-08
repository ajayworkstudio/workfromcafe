# Step 3: struktur database dan skrip salin data

Dikerjakan 8 November 2026. Supabase hanya dibaca, tidak ada yang diubah.

## Hasil

| Yang dicek | Supabase (PostgreSQL 17.11) | `backend/db/schema.sql` |
| --- | --- | --- |
| Tabel | 42 (termasuk tabel tes `_tes_kartu`) | 41, kolom dan tipe sama persis |
| Policy RLS | 86 | 86 |
| Fungsi SQL | 32 | 32, nama sama |
| Trigger di skema public | 6 | 6 |

Migrasi 0030 (keamanan ketat) belum dijalankan di Supabase, jadi juga tidak ada di `schema.sql`.

## File

| File | Isi |
| --- | --- |
| `backend/db/00_supabase_shim.sql` | Pengganti minimal `auth`, `storage`, dan peran `anon`/`authenticated` supaya struktur Supabase bisa dimuat di PostgreSQL biasa. Dihapus setelah step 9 |
| `backend/db/schema.sql` | Struktur lengkap skema public |
| `backend/scripts/salin-dari-supabase.sh` | Salin akun (id dan email) dan seluruh data langsung dari Supabase ke PostgreSQL tujuan, lalu cocokkan jumlah baris tiap tabel |

## Kenapa data asli belum disalin

Domain Supabase tidak bisa dijangkau dari lingkungan kerja Claude, dan data pribadi pengguna sebaiknya tidak lewat chat.
Data disalin di step 4 dengan skrip di atas, dijalankan dari VPS. URL database diisi langsung di VPS, tidak ditulis di Git atau chat.

Acuan jumlah baris di Supabase per 8 November 2026 (untuk dicocokkan setelah salin):
34 akun, 58 kafe, 175 foto, 403 tag kafe, 58 detail kafe, 52 menu, 27 kota, 14 tag, 4 artikel, 33 profil, 35 rekomendasi.
Skrip mengambil angka terbaru saat dijalankan, jadi angka ini hanya untuk gambaran.

## Yang sudah diuji di Postgres lokal

- Struktur dimuat ke database kosong tanpa error.
- 4 tabel tanpa data pribadi (kota, tag, paket kafe, slot iklan) disalin dari Supabase dan isinya cocok (md5 sama).
- Skrip salin: salinan pertama cocok, salinan ulang ke tujuan yang berisi data ditolak, `RESET=1` mengosongkan lalu menyalin ulang.
- Balasan komentar yang tersimpan sebelum komentar induknya tetap tersalin dengan benar.

## Catatan

- `sqlc` tidak dipakai. Query ditulis langsung dengan `database/sql` dan diuji ke PostgreSQL lokal.
- Di VPS butuh `postgresql-client-17` (dari repo resmi PostgreSQL) karena Supabase memakai versi 17.
- Hash password belum disalin. Itu bagian step 9.
