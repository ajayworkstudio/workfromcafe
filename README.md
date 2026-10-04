# WorkFromCafe ☕

Kurasi kafe untuk kerja di kota-kota besar Pulau Jawa, lengkap dengan menu rekomendasi, dengan model langganan.
Bisa dibuka di browser dan di-install di HP (PWA).

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Bricolage Grotesque + Geist · Supabase (Postgres, Auth, Storage, RLS) · Midtrans Snap · Leaflet/OpenStreetMap · Vercel

---

## Cara kerja akses

| Peran | Yang bisa dilihat |
|---|---|
| Pengunjung (belum login) | Daftar kafe, foto, alamat, jam buka, ulasan singkat |
| Member gratis | + favorit, tandai "sudah ke sini", **buka 3 kafe penuh per bulan** |
| Pelanggan premium | Semua ulasan lengkap, tips, menu rekomendasi, peta |
| Admin (kamu) | Dashboard: kelola kafe, foto, menu, kota, lihat pelanggan & pendapatan |

Pembatasan dijalankan di **database (Row Level Security)**, bukan sekadar disembunyikan di tampilan — jadi tidak bisa diakali lewat browser. Harga paket dan batas kafe gratis diatur dari **Admin → Pengaturan**.

---

## Setup di Windows + VS Code

### 1. Install
```bash
npm install
copy .env.example .env.local
```

### 2. Supabase
1. Buat project di [supabase.com](https://supabase.com) (region Singapore).
2. **SQL Editor** → jalankan berurutan: `0001_schema.sql`, `0002_seed.sql`, lalu `0003_optimasi_admin.sql`, `0004_kisaran_harga.sql`, `0005_bayar_manual.sql`, lalu `0006_trial_menu_sheet.sql` (semua di folder `supabase/migrations`).
   Sudah menjalankan 0001 dan 0002 sebelumnya? Cukup jalankan `0003_optimasi_admin.sql`.
3. **Project Settings → API** → salin URL, `anon` key, dan `service_role` key ke `.env.local`.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (nanti ganti ke domain produksi)
   - Redirect URLs: tambahkan `http://localhost:3000/auth/callback` dan `https://domainkamu.com/auth/callback`
5. Login Google — lihat bagian **Login dengan Google** di bawah.

### Login dengan Google
1. Buka [Google Cloud Console](https://console.cloud.google.com) → buat project baru.
2. **APIs & Services → OAuth consent screen** → pilih *External*, isi nama aplikasi, email dukungan, dan logo (opsional) → simpan. Tambahkan email kamu sebagai *Test user* selama status masih "Testing".
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000` dan `https://domainkamu.vercel.app`
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
     (salin persis dari Supabase → Authentication → Providers → Google → *Callback URL*)
4. Salin **Client ID** dan **Client Secret** → tempel di Supabase **Authentication → Providers → Google** → aktifkan → Save.
5. Saat siap dipakai umum, klik **Publish app** di OAuth consent screen supaya semua akun Google bisa login.

Tidak ada variabel `.env` tambahan untuk Google — semuanya disimpan di Supabase.

### 3. Jadikan akunmu admin
Jalankan `npm run dev`, buka http://localhost:3000/masuk, daftar. Lalu di SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'email-kamu@gmail.com';
```
Muat ulang — menu **Admin** muncul di header.

### 4. Midtrans (opsional, saat ini tidak dipakai)
Tombol Midtrans sudah dihapus dari halaman Harga; pembayaran memakai QRIS manual + konfirmasi WhatsApp. Kode webhook masih ada kalau nanti ingin dipakai lagi.

1. Daftar di [dashboard.midtrans.com](https://dashboard.midtrans.com), pilih environment **Sandbox**.
2. **Settings → Access Keys** → salin Server Key & Client Key ke `.env.local`.
3. **Settings → Payment → Notification URL**: `https://domainkamu.com/api/midtrans/notification`
   (untuk tes lokal, pakai [ngrok](https://ngrok.com): `ngrok http 3000` lalu pakai URL ngrok-nya).
4. Uji bayar pakai [simulator sandbox](https://simulator.sandbox.midtrans.com).
5. Untuk produksi: lengkapi verifikasi bisnis di Midtrans, ganti key ke Production, set `MIDTRANS_IS_PRODUCTION=true`.

### 5. Jalankan
```bash
npm run dev
```

---

## Deploy ke Vercel
1. Push ke GitHub, import di [vercel.com](https://vercel.com).
2. Isi semua variabel dari `.env.local` di **Settings → Environment Variables**
   (ubah `NEXT_PUBLIC_SITE_URL` ke domain produksi, isi `CRON_SECRET`).
3. Cron harian (`vercel.json`) otomatis menandai langganan yang habis dan mengirim email pengingat H-3
   (aktif kalau `RESEND_API_KEY` diisi).

---

## Panel admin (`/admin`)
Semua konten diurus dari aplikasi, tanpa menyentuh kode:

| Menu | Yang bisa dilakukan |
|---|---|
| Ringkasan | Pendapatan bulan ini, pelanggan aktif, langganan yang segera berakhir, transaksi terbaru |
| Kafe | Cari & filter, tayangkan/sembunyikan, tandai favorit, tambah, edit, hapus. Edit mencakup foto (sampul, urutan, hapus), menu rekomendasi, info, tag, jam buka. Koordinat bisa diisi dengan menempel link Google Maps |
| Kota | Tambah, edit, aktif/nonaktif, hapus (kalau tidak ada kafenya) |
| Tag | Tambah, ganti nama, hapus tag suasana & fasilitas |
| Pelanggan | Daftar pelanggan aktif & riwayat, beri akses premium manual, hentikan akses |
| Pengaturan | Harga bulanan/tahunan, jumlah kafe gratis per bulan |

## Kelola kafe lewat spreadsheet
Admin → **Spreadsheet**: download template, isi di Google Sheets (bagikan "Siapa saja yang memiliki link"), tempel link-nya, lalu **Sinkronkan sekarang**. Setelah itu sinkron berjalan otomatis setiap hari lewat cron. Bisa juga upload file .xlsx langsung. Sel kosong tidak menimpa data yang sudah ada, dan kafe yang tidak ada di spreadsheet tidak dihapus.

## Trial gratis
Akun baru otomatis mendapat akses penuh selama `trial_days` hari (default 7, ubah di Admin → Pengaturan; 0 = mati).

## Pembayaran manual lewat QRIS (DANA Bisnis, dll.)
1. Admin → Pengaturan: unggah gambar QRIS, isi nomor WhatsApp, centang "Tampilkan opsi bayar via QRIS".
2. Di halaman Harga muncul tombol "Bayar via QRIS". Pelanggan mendapat tagihan dengan **kode unik 3 digit** (mis. Rp25.123) supaya mudah dicocokkan di mutasi.
3. Pelanggan bayar, lalu tekan "Konfirmasi lewat WhatsApp" (pesan berisi kode tagihan, paket, nominal, dan email terisi otomatis).
4. Admin → Pelanggan → "Menunggu konfirmasi": cocokkan nominal dengan mutasi, klik **Setujui**. Premium langsung aktif.

## Alur pembayaran
```
Pilih paket → /api/midtrans/checkout (harga dari server, catat payments=pending)
           → popup Midtrans Snap (QRIS, e-wallet, VA)
           → Midtrans memanggil /api/midtrans/notification
           → verifikasi signature SHA512 + cek nominal
           → payments=paid, buat baris subscriptions (diperpanjang dari tanggal akhir kalau masih aktif)
```

## Struktur folder
```
supabase/migrations/   skema, RLS, data awal kota + 5 kafe contoh (0010 menambah kota besar se-Jawa)
src/app/               halaman (beranda, kafe, kota, peta, harga, akun, masuk, admin)
src/app/api/           checkout & webhook Midtrans, cron pengingat
src/components/        komponen UI, peta, editor admin (foto & menu)
src/lib/               klien Supabase, Midtrans, helper, tipe data
public/                ikon PWA, service worker, halaman offline
```

## Menambah kota/provinsi baru
Admin → **Kota** → tambah kota (isi provinsi & koordinat). Kota otomatis aktif begitu ada kafe yang ditayangkan di sana.

## Catatan
- 5 kafe di data awal adalah **contoh fiktif** — hapus lewat Admin → Kafe setelah mengisi kafe asli.
- Foto otomatis dikompres ke WebP sebelum diunggah.
- Harga paket diatur di **Admin → Pengaturan** (disimpan di tabel `app_settings`). `PRICE_MONTHLY`/`PRICE_YEARLY` di `.env` hanya cadangan kalau tabel belum berisi harga.
