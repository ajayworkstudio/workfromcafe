# Migrasi WFC Hunters ke Go + PostgreSQL

Dikerjakan pelan-pelan, satu step per rilis. Situs tetap memakai Supabase sampai step 10.

| Step | Isi | Status |
| --- | --- | --- |
| 1 | Pemetaan pemakaian Supabase | Selesai, lihat `01-pemetaan.md` |
| 2 | Fondasi API Go di `backend/` | Selesai |
| 3 | Struktur database dan skrip salin data | Selesai, lihat `03-database.md` |
| 4 | VPS Rumahweb, `api.wfchunters.com`, salin data asli | 4a dan 4b selesai (server, API, HTTPS). 4c salin data: berjalan |
| 5 | Fitur baca publik lewat Go | Belum |
| 6 | Storage foto | Belum |
| 7 | Aksi pengguna | Belum |
| 8 | Admin dan pemilik kafe | Belum |
| 9 | Auth | Belum |
| 10 | Pindah total, Supabase jadi cadangan | Belum |
