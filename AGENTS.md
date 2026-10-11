# WFC Hunters (workfromcafe)

## Tujuan project

WFC Hunters adalah web app sekaligus PWA (bisa di-install di HP) berisi kurasi kafe yang nyaman untuk kerja di kota-kota besar Pulau Jawa: Jakarta, Bandung, Yogyakarta, Semarang, Solo, Surabaya, Malang, dan lainnya. Setiap kafe punya penilaian kerja (internet, colokan, kenyamanan, dll.), fasilitas, jam buka, menu rekomendasi, foto asli, dan peta.

Isinya ditulis oleh pemilik dan para author, yaitu pengguna yang mengirim rekomendasi kafe lewat `/kirim`. Admin mereview rekomendasi itu sebelum tayang.

Nama brand di UI adalah **WFC Hunters**. Nama teknis di kode adalah `WorkFromCafe` (`APP_NAME` di `src/lib/utils.ts`). Nama paket `kafe-jateng` di `package.json` tersisa dari versi awal yang hanya mencakup Jawa Tengah. Jangan diganti tanpa diminta.

## Aturan produk saat ini

### Login hanya untuk author

- Login dipakai oleh author yang menyumbang rekomendasi kafe, dan oleh admin. Pengunjung biasa tidak perlu login untuk membaca apa pun.
- Halaman yang wajib login didaftarkan di `PROTECTED` pada `src/middleware.ts`: `/akun`, `/admin`, `/bayar`, `/kirim/baru`.
- Ada dua cara masuk: email + kata sandi, atau Google OAuth lewat Supabase Auth (`src/app/masuk/LoginForm.tsx`, `src/app/auth/callback`, `src/app/auth/confirm`).
- Saat ini akun yang login juga bisa memakai favorit dan komentar. Fitur baru untuk pembaca jangan dibuat bergantung pada login.

### Semua fitur gratis, fitur berbayar disembunyikan

- Saklar mode gratis adalah `free_mode` di tabel `app_settings`. Nilai bawaannya `true`, dibaca lewat `getSettings()` di `src/lib/settings.ts`, dan bisa diubah di Admin → Pengaturan.
- Selama `free_mode` menyala:
  - `/harga` dan aksi `/bayar` mengalihkan ke `/kafe`.
  - Link Harga di Header dan Footer, `TrialBanner`, dan lencana premium disembunyikan.
  - Ulasan lengkap, menu, dan peta terbuka untuk semua orang.
  - Cron tidak mengirim pengingat perpanjangan.
  - Migrasi 0016 menghapus trial.
- Kode berbayar tetap disimpan untuk dipakai nanti dan tidak boleh dihapus: Midtrans (`src/lib/midtrans.ts`, `src/app/api/midtrans/*`), QRIS manual (`src/app/bayar`), langganan (`src/lib/subscription.ts`), dan Admin → Pelanggan.
- Fitur baru tidak boleh dikunci di balik `isPremium`. Kalau sebuah tampilan atau batasan khusus untuk mode berbayar, bungkus dengan pengecekan `!settings.free_mode` seperti pola di `Header.tsx` dan `kafe/[slug]/page.tsx`.
- Jangan menampilkan harga, ajakan berlangganan, atau kata "premium" di UI publik.

## Tech stack

- Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript dalam mode `strict`.
- Tailwind CSS v4 lewat `@tailwindcss/postcss`. Token warna dan utilitas ada di `src/app/globals.css`, dan tidak ada `tailwind.config`.
- Supabase: Postgres, Auth, Storage (bucket `cafe-photos`), dan RLS. Klien dibuat dengan `@supabase/ssr` dan `@supabase/supabase-js`.
- Peta: Leaflet + react-leaflet dengan OpenStreetMap.
- Animasi: GSAP + ScrollTrigger, hanya dipakai di beranda.
- Font: Plus Jakarta Sans (`@fontsource-variable`, ditambah file .woff di `src/assets/fonts` untuk gambar OG dan kartu author).
- Lain-lain: `read-excel-file` untuk sinkron spreadsheet, `sharp`, `nodemailer` (Gmail SMTP) atau Resend untuk email.
- Deploy di Vercel, region `sin1`. Cron harian `/api/cron/reminder` dijadwalkan di `vercel.json`.
- PWA: `src/app/manifest.ts`, `public/sw.js` (cache aset statis + `offline.html`), didaftarkan oleh `src/components/RegisterSW.tsx`.

## Struktur folder

```
src/app/                 halaman & route (nama route berbahasa Indonesia)
  page.tsx               beranda
  kafe/, kafe/[slug]/    daftar & detail kafe (favorit, komentar: actions.ts, comments.ts)
  kota/[slug]/           kafe per kota
  peta/                  peta semua kafe
  kirim/, kirim/baru/    alur author: daftar kiriman & form rekomendasi
  author/, author/[key]/ profil author publik, kartu Kurator (route.tsx), OG image
  event/                 event (umum melihat "Segera" kalau events_public = false)
  akun/                  profil & favorit pengguna yang login
  masuk/, auth/          login, callback OAuth, konfirmasi email
  kontak/                kotak kontak
  harga/, bayar/         langganan & bayar QRIS (tersembunyi saat free_mode)
  admin/                 panel admin: kafe, rekomendasi, event, komentar, pesan,
                         spreadsheet, kota, tag, pengguna, pelanggan, pengaturan
  api/cron/reminder/     cron harian: langganan kedaluwarsa, pengingat, sinkron sheet
  api/midtrans/          checkout & webhook Midtrans (tidak dipakai sekarang)
  manifest.ts, robots.ts, sitemap.ts, layout.tsx, error.tsx, not-found.tsx
src/components/          komponen UI publik (CafeCard, CafeMap, Header, Icon, ...)
src/components/admin/    form & editor panel admin (CafeForm, PhotoManager, ...)
src/lib/                 logika bersama
  supabase/server.ts     createClient / createPublicClient / createAdminClient
  supabase/client.ts     klien Supabase untuk browser
  auth.ts                getViewer() (di-cache per request), requireAdmin()
  settings.ts            getSettings() dari app_settings (cache tag "settings")
  author.ts              level author, daftar author (cache tag "authors")
  review.ts, submission.ts, types.ts, utils.ts, sheetSync.ts, ...
src/middleware.ts        refresh sesi Supabase + proteksi halaman wajib login
src/assets/fonts/        font untuk gambar yang dibuat di server
public/                  logo, ikon PWA, sw.js, offline.html, template spreadsheet
supabase/migrations/     0001 sampai 0016, dijalankan manual dan berurutan
DESIGN.md                arah desain (identitas, palet, tipografi, gerak)
.claude/skills/          skill antislop (filter UI, copy, layout HP, komentar kode)
```

## Menjalankan project

Butuh Node.js (versi terbaru yang dipakai adalah v26) dan project Supabase. Langkah lengkap ada di `README.md`.

```bash
npm install
cp .env.example .env.local   # isi URL & key Supabase, NEXT_PUBLIC_SITE_URL, CRON_SECRET
npm run dev                  # http://localhost:3000
```

- Migrasi database: jalankan file di `supabase/migrations/` secara manual dan berurutan di Supabase SQL Editor.
- Admin: daftar lewat `/masuk`, lalu jalankan `update public.profiles set role = 'admin' where email = '...'`.
- Tanpa tiga env wajib (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `layout.tsx` hanya menampilkan halaman "Konfigurasi belum lengkap".

### Cek sebelum menyerahkan

```bash
npm run typecheck
NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=demo SUPABASE_SERVICE_ROLE_KEY=x npx next build
```

Untuk build produksi pakai `npm run build`, dan untuk menjalankan hasil build pakai `npm run start`. Project ini belum punya script lint maupun test.

## Konvensi kode

### Umum

- Pakai import alias `@/*` untuk `src/*`.
- Komponen default-nya Server Component. Tambahkan `"use client"` hanya untuk komponen yang butuh interaksi, state, atau API browser.
- Mutasi data dikerjakan lewat Server Actions:
  - di `actions.ts` di samping route, atau
  - fungsi `"use server"` inline di halaman admin.
- Server Action untuk form dengan `useActionState` memakai pola `(prev, formData) => State | null`, lalu memanggil `revalidatePath`/`revalidateTag` dan `redirect`.
- Validasi input di server: potong panjang, `trim`, dan izinkan hanya nilai yang dikenal. Sertakan juga batas kirim (rate limit) per pengguna, seperti di `kirim/actions.ts` dan `comments.ts`.
- Pesan error untuk pengguna ditulis dalam Bahasa Indonesia yang ramah. Kalau tabel/kolom belum ada, tampilkan pesan "Admin perlu menjalankan migrasi 00NN" alih-alih crash.
- Waktu dihitung dalam zona `Asia/Jakarta` (WIB). Tanggal dan angka diformat dengan locale `id-ID`; untuk uang pakai `rupiah()` di `utils.ts`.

### Supabase dan keamanan

- `createClient()` dipakai untuk sesi pengguna (tunduk RLS).
- `createPublicClient()` dipakai untuk data publik yang di-cache lintas request.
- `createAdminClient()` (service role, melewati RLS) hanya boleh di server: webhook, cron, dan aksi admin yang memang butuh.
- RLS adalah penjaga utama akses data, bukan tampilan. Aksi admin wajib memanggil `requireAdmin()`.
- Ambil info pengguna dengan `getViewer()`, jangan query profil sendiri di setiap komponen.
- Pengaturan yang bisa diubah admin disimpan di `app_settings` dan dibaca lewat `getSettings()`. Setelah mengubahnya, panggil `revalidateTag("settings")`. Perubahan kafe/author/profil memanggil `revalidateTag("authors")`.
- Foto dikompres ke WebP di browser (`src/lib/compressImage.ts`) sebelum diunggah ke bucket `cafe-photos`.

### Migrasi SQL

- Tambahkan file baru `supabase/migrations/00NN_nama_singkat.sql` dengan nomor berikutnya. Jangan mengubah migrasi lama.
- Beri header komentar berisi tujuan dan cara menjalankan, dan buat migrasinya aman dijalankan ulang (`if not exists`, `on conflict do nothing`, `create or replace`).

### UI dan teks

- Pakai token warna dari `@theme` di `globals.css`: `brand`, `ink`, `canvas`, `surface`, `muted`, `tint`, `line`, `tan`, `gold`, `ok`.
- Pakai utilitas yang sudah ada: `btn`, `btn-primary`, `btn-dark`, `btn-ghost`, `input`, `label`, `chip`, `card`. Ikon lewat `src/components/Icon.tsx`.
- Tidak boleh menambah warna baru tanpa alasan di `DESIGN.md`.
- Desain mobile-first: ada navigasi bawah di HP, perhatikan `safe-area-inset-bottom`.
- Copy pakai Bahasa Indonesia santai, kalimat pendek, tanpa em dash, dan tanpa kata promosi kosong.
- Jangan menulis angka/statistik yang tidak berasal dari database.
- Komentar kode berbahasa Indonesia dan hanya menjelaskan alasan atau hal yang tidak terlihat dari kode, misalnya kebutuhan migrasi atau perilaku cache.

### Line ending

- `.gitattributes` memaksa LF (`* text=auto eol=lf`). Simpan file dengan LF.

## Aturan UI, teks, dan kode: antislop

Untuk pekerjaan UI, copy, tata letak HP, atau komentar kode:

1. Baca `DESIGN.md` untuk arah desain (identitas, palet, tipografi, dial).
2. Baca skill antislop yang sesuai di `.claude/skills/` sebagai filter:
   - inti (selalu): `.claude/skills/antislop/SKILL.md`
   - UI: `.claude/skills/antislop-ui/SKILL.md`
   - copy: `.claude/skills/antislop-copywriting/SKILL.md`
   - HP/responsif: `.claude/skills/antislop-layoutmobile/SKILL.md`
   - orang/foto/avatar: `.claude/skills/antislop-human/SKILL.md`
   - komentar kode: `.claude/skills/antislop-code/SKILL.md`
3. Mode antislop proyek ini: **during** (dipilih pemilik proyek). Jalankan Delivery Gate sebelum menyerahkan.
