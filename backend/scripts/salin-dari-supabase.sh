#!/usr/bin/env bash
# Salin struktur dan data WFC Hunters dari Supabase ke PostgreSQL baru, langsung server ke server.
# Jalankan dari VPS (step 4). Data tidak lewat laptop atau chat.
#
# Kebutuhan:
#   - pg_dump dan psql versi 17 atau lebih baru (Supabase memakai PostgreSQL 17)
#   - TARGET_DATABASE_URL memakai user superuser (postgres di VPS), karena pemeriksaan
#     foreign key dimatikan sementara saat data dimuat
#
# Pakai:
#   export SOURCE_DATABASE_URL='...'   # Supabase: Project Settings > Database > Session pooler
#   export TARGET_DATABASE_URL='...'   # PostgreSQL tujuan
#   ./scripts/salin-dari-supabase.sh           # tujuan harus kosong
#   RESET=1 ./scripts/salin-dari-supabase.sh   # kosongkan tujuan dulu, lalu salin ulang
#
# Jangan simpan kedua URL di file yang masuk Git.
set -euo pipefail

: "${SOURCE_DATABASE_URL:?isi SOURCE_DATABASE_URL dulu}"
: "${TARGET_DATABASE_URL:?isi TARGET_DATABASE_URL dulu}"
SRC=$SOURCE_DATABASE_URL
DST=$TARGET_DATABASE_URL
MIN_PG=${MIN_PG:-17}
DB_DIR="$(cd "$(dirname "$0")/../db" && pwd)"
SKIP_TABLES="_tes_kartu"   # tabel tes di Supabase, tidak ikut disalin

major=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
if [ "$major" -lt "$MIN_PG" ]; then
  echo "pg_dump versi $major terlalu lama, butuh $MIN_PG atau lebih baru." >&2
  exit 1
fi

count_sql="select string_agg(format('%s=%s', relname,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', relname), false, true, '')))[1]::text),
  E'\n' order by relname)
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind = 'r' and relname not in ('$SKIP_TABLES')"

echo "1/4 Menyiapkan struktur di tujuan"
tables=$(psql "$DST" -tAc "select count(*) from pg_tables where schemaname = 'public'")
if [ "$tables" -eq 0 ]; then
  psql "$DST" -q -v ON_ERROR_STOP=1 -f "$DB_DIR/00_supabase_shim.sql" -f "$DB_DIR/schema.sql" >/dev/null
else
  has_data=$(psql "$DST" -tAc "select exists (select 1 from public.cafes) or exists (select 1 from public.profiles) or exists (select 1 from auth.users)")
  if [ "$has_data" = t ] && [ "${RESET:-0}" != 1 ]; then
    echo "Tujuan sudah berisi data. Jalankan dengan RESET=1 untuk mengosongkan lalu menyalin ulang." >&2
    exit 1
  fi
  if [ "${RESET:-0}" = 1 ]; then
    PGOPTIONS='-c client_min_messages=warning' psql "$DST" -q -v ON_ERROR_STOP=1 -c "
      do \$\$ declare t text; begin
        for t in select tablename from pg_tables where schemaname = 'public' loop
          execute format('truncate table public.%I restart identity cascade', t);
        end loop;
        truncate auth.users cascade;
      end \$\$;"
  fi
fi

echo "2/4 Menyalin akun (id dan email saja, password menyusul di step 9)"
psql "$SRC" -q -c "\copy (select id, email, raw_user_meta_data, created_at from auth.users) to stdout" \
  | psql "$DST" -q -v ON_ERROR_STOP=1 -c "\copy auth.users (id, email, raw_user_meta_data, created_at) from stdin"

echo "3/4 Menyalin data tabel"
# pg_dump memperingatkan foreign key melingkar di cafe_comments (balasan menunjuk komentar induk).
# Itu wajar: pemeriksaan foreign key dimatikan sementara lewat session_replication_role.
pg_dump "$SRC" --data-only --no-owner --no-privileges -n public --exclude-table="public.$SKIP_TABLES" \
  2> >(grep -v -e 'circular foreign-key' -e 'detail: cafe_comments' -e 'without using --disable-triggers' -e 'instead of a --data-only dump' >&2) \
  | sed -e '/^\\restrict /d' -e '/^\\unrestrict /d' \
  | psql "$DST" -q -v ON_ERROR_STOP=1 --single-transaction \
      -c "set session_replication_role = replica" -f - >/dev/null

echo "4/4 Mencocokkan jumlah baris"
src_counts=$(psql "$SRC" -tAc "$count_sql")
dst_counts=$(psql "$DST" -tAc "$count_sql")
src_users=$(psql "$SRC" -tAc "select count(*) from auth.users")
dst_users=$(psql "$DST" -tAc "select count(*) from auth.users")
if [ "$src_counts" = "$dst_counts" ] && [ "$src_users" = "$dst_users" ]; then
  echo "Cocok: $(echo "$src_counts" | wc -l) tabel dan $dst_users akun."
else
  echo "BEDA. Kiri = Supabase, kanan = tujuan:" >&2
  diff <(echo "$src_counts"; echo "auth.users=$src_users") <(echo "$dst_counts"; echo "auth.users=$dst_users") >&2 || true
  exit 1
fi
