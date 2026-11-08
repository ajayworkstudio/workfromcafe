# Step 6: foto di disk VPS

Diputuskan 9 November 2026: foto disimpan di disk VPS, bukan Cloudflare R2.

| | Supabase sekarang | VPS |
| --- | --- | --- |
| Isi | Bucket `cafe-photos` publik, 415 file, sekitar 471 MB (9 Nov 2026) | `/var/lib/wfc/foto/storage/v1/object/public/cafe-photos/` |
| Alamat | `https://glsqzpuewndbupblmqzm.supabase.co/storage/v1/object/public/cafe-photos/<nama>` | `https://foto.wfchunters.com/storage/v1/object/public/cafe-photos/<nama>` |

Susunan alamat sengaja dibuat sama. Saat pindah total (step 10), alamat foto di database
(`cafe_photos.url`, `thumb_url`, `articles.cover_url`, gambar di isi artikel, `profiles.avatar_url`,
`menu_items.photo_url`, `events.cover_url`) cukup diganti bagian domainnya, dan `next.config` diberi domain baru.

## Perintah di VPS

```sh
python3 /opt/wfc/src/backend/scripts/salin-foto.py         # salin atau sinkronkan, aman diulang
python3 /opt/wfc/src/backend/scripts/salin-foto.py --cek   # bandingkan isi 5 foto acak dengan Supabase
```

Upload foto dari browser tetap lewat Supabase sampai login pindah (step 9). Sebelum step 10, foto disinkronkan sekali lagi.

## Diuji di lingkungan kerja Claude

Salinan pertama, salinan ulang (melewati file yang sudah ada), file rusak diunduh ulang dengan isi sama persis,
dan nama file berbahaya (`../../`) ditolak tanpa menulis di luar folder foto.
