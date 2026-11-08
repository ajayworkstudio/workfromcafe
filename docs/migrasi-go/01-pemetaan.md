# Migrasi ke Go + PostgreSQL: Step 1, pemetaan

Dipetakan 8 November 2026 dari kode di `src/` dan migrasi `supabase/migrations/0001` sampai `0031`.
Belum ada yang diubah. Dokumen ini jadi daftar centang untuk step 5 sampai 9.

## Angka keseluruhan

| Bagian Supabase | Jumlah di kode | Ganti di Go |
| --- | --- | --- |
| File yang memanggil Supabase | 98 file | Panggilan ke API Go |
| Tabel yang dipakai (`.from()`) | 37 tabel | Query `database/sql` per endpoint |
| Fungsi SQL (`.rpc()`) | 20 fungsi dipanggil, 34 ada di migrasi | Tetap fungsi SQL, dipanggil dari Go |
| Policy RLS | 104 policy | Middleware Go (cek login, peran, pemilik data) |
| Trigger | 7 trigger | Tetap di database, kecuali yang bergantung pada `auth.users` |
| Storage | 1 bucket `cafe-photos`: upload, list, remove, getPublicUrl | Endpoint upload Go + R2 atau disk VPS |
| Auth | getUser, getClaims, signUp, signInWithPassword, signInWithOAuth, verifyOtp, exchangeCodeForSession, signOut | Session + Google OAuth di Go |
| Realtime | Tidak dipakai | Tidak perlu diganti |
| Route API & cron | `api/admin`, `api/cron` (reminder, backup-drive), `api/dukungan`, `api/lihat`, `api/lihat-artikel`, `api/midtrans`, `api/speedtest` | Dipindah ke Go atau tetap di Next.js memanggil Go |

## Kelompok untuk dipindah, sesuai urutan step

### Step 5: fitur baca publik (risiko rendah)

| Tabel / fungsi | Dipakai di |
| --- | --- |
| `cafes` (52), `cities` (28), `tags` (10), `cafe_tags` (5) | Beranda, daftar kafe, kota, area, peta |
| `cafe_photos` (16), `cafe_details` (6), `menu_items` (11), `cafe_quality_scores` (3) | Detail kafe |
| `articles` (7), `content_translations` (2) | Artikel, terjemahan EN |
| `app_settings` (9, hanya kunci publik) | Pengaturan tampilan |
| rpc `authors_list`, `author_card`, `cafe_comments_list`, `cafe_reports_live`, `cafe_reports_recent`, `supporters_public`, `platform_reach`, `cafes_stats_overview` | Author, komentar, kondisi, dukung |

### Step 6: storage foto

- Bucket `cafe-photos`: 8 upload, 5 remove, 4 list, 8 getPublicUrl.
- **8 komponen mengunggah langsung dari browser** dan perlu diganti ke endpoint upload Go:
  `admin/PhotoManager`, `admin/ArticleEditor`, `admin/QrisUploader`, `admin/ImageUploader`, `admin/MenuEditor`, `masuk/LoginForm`, `kirim/baru/SubmitForm`, `akun/ProfileEditor`.

### Step 7: aksi pengguna (risiko sedang, butuh login)

| Tabel / fungsi | Fitur |
| --- | --- |
| `cafe_comments` (7), `cafe_reports` (2) | Komentar, lapor kondisi |
| `cafe_submissions` (23) | Kirim rekomendasi |
| `favorites` (6), `user_visits` (4), `article_likes` (1), `article_saves` (3) | Simpan, tandai, suka |
| `profiles` (33) | Edit profil |
| `notifications` (8), `notification_dismissals` (2), `push_subscriptions` (4) | Notifikasi |
| `contact_messages` (9) | Kotak saran |
| rpc `unlock_cafe`, `free_unlocks_left`, `notif_unread_count`, `log_article_view`, `log_cafe_event`, `record_ad_click`, `serve_sponsored` | Buka kafe, statistik, iklan |

### Step 8: admin dan pemilik kafe

| Tabel / fungsi | Fitur |
| --- | --- |
| `payments` (16), `subscriptions` (12) | Pembayaran, langganan |
| `cafe_owners` (15), `cafe_subscriptions` (9), `cafe_plans` (5), `owner_messages` (5) | Dashboard pemilik |
| `ad_campaigns` (6), `ad_targets` (3), `ad_wallets` (2), `wallet_transactions` (1), `ad_impressions` (1), `ad_clicks` (1) | Iklan Sponsored |
| `events` (8), `supporters` (5) | Event, pendukung |
| rpc `admin_stats`, `admin_usage_counts`, `admin_wallet_adjust`, `cafe_stats`, `owner_messages_mark_read` | Statistik admin dan pemilik |
| Route `api/midtrans`, `api/cron/reminder`, `api/cron/backup-drive` | Webhook bayar, cron harian |

### Step 9: auth (risiko tertinggi, paling akhir)

- 8 jenis panggilan auth di atas, plus `getUser` (12) dan `getClaims` (7) untuk cek siapa yang login.
- Trigger `on_auth_user_created` membuat baris `profiles` saat akun baru dibuat. Di Go, ini pindah ke handler daftar.
- Trigger `profiles_protect_role` mencegah pengguna menaikkan perannya sendiri. Tetap dipakai atau dipindah ke Go.
- Kolom `profiles.id` merujuk ke `auth.users.id`. Saat pindah, id dan hash password pengguna disalin ke tabel `users` baru supaya akun lama tetap bisa masuk.

## Catatan untuk step berikutnya

- RLS saat ini menjaga keamanan di database. Selama Next.js masih memanggil Supabase langsung, RLS tetap aktif. API Go memakai koneksi database tersendiri, jadi setiap endpoint Go wajib mengecek akses sendiri sebelum query.
- Fungsi SQL yang `security definer` bisa langsung dipanggil dari Go, tapi pengecekan `auth.uid()` di dalamnya perlu diganti parameter user id dari Go.
- Cron `backup-drive` saat ini membackup lewat Supabase. Setelah pindah, ganti dengan `pg_dump` harian di VPS.
