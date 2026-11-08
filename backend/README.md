# API Go WFC Hunters

Backend Go yang pelan-pelan menggantikan panggilan Supabase. Rencana lengkap ada di `docs/migrasi-go/`.

## Isi

| Folder | Isi |
| --- | --- |
| `cmd/api` | Program utama: baca config, buka database, jalankan server, matikan dengan rapi |
| `internal/config` | Pengaturan dari environment (`PORT`, `DATABASE_URL`, `ALLOWED_ORIGINS`) |
| `internal/database` | Koneksi PostgreSQL (`database/sql` + `lib/pq`) |
| `internal/httpapi` | Router `chi`, middleware (log, header keamanan, CORS), dan endpoint |

## Endpoint

| Method | Path | Balasan |
| --- | --- | --- |
| GET | `/health` | `{"status":"ok","database":"ok"}`. Database mati: status 503 dan `"database":"down"` |
| GET | `/v1/cities` | Kota aktif, urut nama |
| GET | `/v1/tags` | Semua tag, urut nama |
| GET | `/v1/cafes?kota=&q=&harga=` | Daftar kafe tayang, bentuk sama dengan `CAFE_LIST_SELECT` di Next.js |
| GET | `/v1/cafes/{slug}` | `{"cafe", "details", "menu"}`. Kafe belum tayang: 404 |

Semua query `/v1` berjalan sebagai peran `anon`, jadi policy RLS di `db/schema.sql` tetap menyaring data.
Peran login `wfc_api` sendiri tidak punya hak membaca tabel (lihat `db/01_grants.sql`).

## Menjalankan

Butuh Go 1.24 atau lebih baru.

```sh
cd backend
cp .env.example .env        # isi DATABASE_URL
go test ./...               # tes database ikut jalan kalau TEST_DATABASE_URL (wfc_api) dan TEST_ADMIN_URL (superuser) diisi
go run ./cmd/api            # baca env dari shell, misalnya: set -a; . ./.env; set +a
curl localhost:8080/health
```

Database baru dari nol:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/00_supabase_shim.sql -f db/schema.sql -f db/01_grants.sql
```

Salin data dari Supabase (dijalankan di VPS, lihat `docs/migrasi-go/03-database.md`):

```sh
export SOURCE_DATABASE_URL='...' TARGET_DATABASE_URL='...'
./scripts/salin-dari-supabase.sh
```

Bandingkan API Go dengan Supabase (di VPS):

```sh
python3 scripts/banding-supabase.py
```

Build untuk VPS Linux:

```sh
GOOS=linux GOARCH=amd64 go build -o bin/wfc-api ./cmd/api
```
