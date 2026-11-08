# Migrasi WFC Hunters ke Go + PostgreSQL

Dikerjakan pelan-pelan, satu step per rilis. Situs tetap memakai Supabase sampai step 10.

| Step | Isi | Status |
| --- | --- | --- |
| 1 | Pemetaan pemakaian Supabase | Selesai, lihat `01-pemetaan.md` |
| 2 | Fondasi API Go di `backend/` | Selesai |
| 3 | Struktur database dan skrip salin data | Selesai, lihat `03-database.md` |
| 4 | VPS Rumahweb, `api.wfchunters.com`, salin data asli | Selesai 9 Nov 2026: API jalan dengan HTTPS, data tersalin (41 tabel, 34 akun, cocok) |
| 5 | Fitur baca publik lewat Go | 5a (kota, tag, daftar dan detail kafe): endpoint jadi, menunggu dibandingkan dengan Supabase |
| 6 | Storage foto | Belum |
| 7 | Aksi pengguna | Belum |
| 8 | Admin dan pemilik kafe | Belum |
| 9 | Auth | Belum |
| 10 | Pindah total, Supabase jadi cadangan | Belum |
