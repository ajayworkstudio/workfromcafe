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

## Menjalankan

Butuh Go 1.24 atau lebih baru.

```sh
cd backend
cp .env.example .env        # isi DATABASE_URL
go test ./...
go run ./cmd/api            # baca env dari shell, misalnya: set -a; . ./.env; set +a
curl localhost:8080/health
```

Build untuk VPS Linux:

```sh
GOOS=linux GOARCH=amd64 go build -o bin/wfc-api ./cmd/api
```
